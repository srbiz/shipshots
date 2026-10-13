"use client";

import { Copy, LayoutTemplate, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TEMPLATE_CATEGORIES } from "@/lib/catalog";
import { api, errMsg } from "@/lib/client/api";
import { DEFAULT_SPEC, normalizeSpec, pickStyle, type Platform, type ScreenshotDTO, type ScreenshotSpec, type TemplateDTO } from "@/lib/types";
import { BackgroundPanel, DevicePanel, LayoutPicker, Section, TypographyPanel } from "../editor/panels";
import { ShotCanvas } from "../shot-canvas";
import { Badge, Button, cn, ConfirmDialog, EmptyState, Field, Input, Menu, Modal, PageHeader, Segmented, Select } from "../ui";

const SAMPLE = normalizeSpec({ ...DEFAULT_SPEC, eyebrow: "", headline: "Ship *faster* from anywhere", subheadline: "Pipelines, reviews and releases in one app.", screen: { kind: "mock", mock: "dashboard", dark: true }, screen2: { kind: "mock", mock: "analytics", dark: true } });
type ProjectLite = { id: string; name: string; platforms: Platform };

export function TemplatesView({ initial, projects }: { initial: TemplateDTO[]; projects: ProjectLite[] }) {
  const [templates, setTemplates] = useState(initial);
  const [filter, setFilter] = useState<"all" | "builtin" | "mine">("all");
  const [category, setCategory] = useState("All");
  const [editing, setEditing] = useState<TemplateDTO | "new" | null>(null);
  const [using, setUsing] = useState<TemplateDTO | null>(null);
  const [toDelete, setToDelete] = useState<TemplateDTO | null>(null);
  const [pending, setPending] = useState<string[]>([]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(templates.map((t) => t.category)))], [templates]);
  const list = templates.filter((t) => (filter === "all" || (filter === "builtin" ? t.isBuiltin : !t.isBuiltin)) && (category === "All" || t.category === category));
  const mine = templates.filter((t) => !t.isBuiltin).length;

  const duplicate = async (t: TemplateDTO) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    setTemplates((x) => [...x, { ...t, id: tempId, name: `${t.name} copy`, isBuiltin: false, category: "Custom" }]);
    setPending((x) => [...x, tempId]);
    try {
      const created = await api<TemplateDTO>("templates", { body: { name: `${t.name} copy`, description: t.description, category: "Custom", spec: t.spec } });
      setTemplates((x) => x.map((y) => (y.id === tempId ? created : y)));
      toast.success("Template duplicated", { description: "Find it under “Mine”." });
    } catch (e) {
      setTemplates((x) => x.filter((y) => y.id !== tempId));
      toast.error(errMsg(e));
    } finally {
      setPending((x) => x.filter((y) => y !== tempId));
    }
  };

  const remove = async (t: TemplateDTO) => {
    const snapshot = templates;
    setTemplates((x) => x.filter((y) => y.id !== t.id));
    try {
      await api(`templates/${t.id}`, { method: "DELETE" });
      toast.success("Template deleted");
    } catch (e) {
      setTemplates(snapshot);
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <PageHeader
        eyebrow="Library"
        title="Templates"
        description="Reusable looks — layout, background, type and device frame. Apply to a screenshot or a whole set."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setEditing("new")}>
            New template
          </Button>
        }
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All (${templates.length})` },
            { value: "builtin", label: "Built-in" },
            { value: "mine", label: `Mine (${mine})` },
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition", category === c ? "bg-white/10 text-white ring-white/20" : "text-zinc-400 ring-white/[0.07] hover:text-zinc-200")}>
              {c}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate />}
          title={filter === "mine" ? "No custom templates yet" : "No templates match"}
          description={filter === "mine" ? "Save any screenshot’s look from the editor, duplicate a built-in, or design one from scratch." : "Try another category."}
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => setEditing("new")}>
              Create template
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((t) => (
            <div key={t.id} className={cn("group", pending.includes(t.id) && "pointer-events-none opacity-50")}>
              <div className="relative">
                <ShotCanvas spec={normalizeSpec({ ...SAMPLE, ...t.spec })} sizeId="iphone-69" className="ring-1 ring-white/[0.08] transition group-hover:ring-indigo-400/50" />
                <div className="absolute inset-x-2 bottom-2 flex translate-y-1 gap-1.5 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                  <Button size="sm" variant="primary" className="flex-1" icon={<Wand2 />} onClick={() => setUsing(t)}>
                    Use
                  </Button>
                </div>
              </div>
              <div className="mt-2.5 flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-zinc-100">{t.name}</span>
                    {!t.isBuiltin && <Badge tone="violet">Mine</Badge>}
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-snug text-zinc-500">{t.description || t.category}</p>
                </div>
                <Menu
                  items={[
                    { label: "Use template", icon: <Wand2 />, onClick: () => setUsing(t) },
                    { label: "Duplicate", icon: <Copy />, onClick: () => duplicate(t) },
                    ...(!t.isBuiltin ? [{ label: "Edit", icon: <Pencil />, onClick: () => setEditing(t) }, { label: "Delete", icon: <Trash2 />, danger: true, onClick: () => setToDelete(t) }] : []),
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <TemplateEditorModal
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(t, isNew) => setTemplates((x) => (isNew ? [...x, t] : x.map((y) => (y.id === t.id ? t : y))))}
        />
      )}
      {using && <UseTemplateModal template={using} projects={projects} onClose={() => setUsing(null)} />}
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={`Delete “${toDelete?.name}”?`} description="Screenshots that already use this look keep their styling." onConfirm={() => (toDelete ? remove(toDelete) : undefined)} />
    </div>
  );
}

function TemplateEditorModal({ template, onClose, onSaved }: { template: TemplateDTO | null; onClose: () => void; onSaved: (t: TemplateDTO, isNew: boolean) => void }) {
  const [meta, setMeta] = useState({ name: template?.name ?? "", description: template?.description ?? "", category: template?.category ?? "Custom" });
  const [spec, setSpec] = useState<ScreenshotSpec>(() => normalizeSpec({ ...SAMPLE, ...(template?.spec ?? {}) }));
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<ScreenshotSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...meta, spec: pickStyle(spec) };
      const t = template ? await api<TemplateDTO>(`templates/${template.id}`, { method: "PATCH", body }) : await api<TemplateDTO>("templates", { body });
      onSaved(t, !template);
      toast.success(template ? "Template updated" : "Template created");
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
      size="xl"
      title={template ? `Edit “${template.name}”` : "New template"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="tpl-form" loading={busy}>
            {template ? "Save template" : "Create template"}
          </Button>
        </>
      }
    >
      <form id="tpl-form" onSubmit={save} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Name">
              <Input required autoFocus value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Launch week" maxLength={60} />
            </Field>
            <Field label="Category">
              <Select value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="When to use this look" maxLength={200} />
          </Field>
          <div className="-mx-4 rounded-xl border border-white/[0.06]">
            <Section title="Layout">
              <LayoutPicker spec={spec} onChange={update} sizeId="iphone-69" />
            </Section>
            <Section title="Background">
              <BackgroundPanel spec={spec} onChange={update} />
            </Section>
            <Section title="Typography" defaultOpen={false}>
              <TypographyPanel spec={spec} onChange={update} />
            </Section>
            <Section title="Device" defaultOpen={false}>
              <DevicePanel spec={spec} onChange={update} />
            </Section>
          </div>
        </div>
        <div className="md:sticky md:top-0 md:self-start">
          <div className="mb-1.5 text-xs font-medium text-zinc-400">Live preview</div>
          <ShotCanvas spec={spec} sizeId="iphone-69" className="ring-1 ring-white/10" />
        </div>
      </form>
    </Modal>
  );
}

function UseTemplateModal({ template, projects, onClose }: { template: TemplateDTO; projects: ProjectLite[]; onClose: () => void }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState<"new" | "all" | null>(null);
  const createShot = async () => {
    setBusy("new");
    try {
      const s = await api<ScreenshotDTO>(`projects/${projectId}/screenshots`, { body: { templateId: template.id } });
      toast.success(`New screenshot with “${template.name}”`);
      router.push(`/projects/${projectId}/screenshots/${s.id}`);
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(null);
    }
  };
  const applyAll = async () => {
    setBusy("all");
    try {
      const list = await api<ScreenshotDTO[]>(`projects/${projectId}/apply-template`, { body: { templateId: template.id } });
      toast.success(`Applied to ${list.length} screenshots`, { action: { label: "Open", onClick: () => router.push(`/projects/${projectId}`) } });
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal open onClose={onClose} size="sm" title={`Use “${template.name}”`} description="Start a new screenshot or restyle an entire set.">
      {projects.length === 0 ? (
        <p className="text-sm text-zinc-400">Create a project first, then come back to apply this template.</p>
      ) : (
        <div className="space-y-4">
          <Field label="Project">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-2">
            <Button variant="primary" icon={<Plus />} onClick={createShot} loading={busy === "new"} disabled={!!busy}>
              Create a new screenshot
            </Button>
            <Button icon={<Wand2 />} onClick={applyAll} loading={busy === "all"} disabled={!!busy}>
              Apply to every screenshot in the set
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
