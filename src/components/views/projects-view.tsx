"use client";

import { FolderKanban, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/client/api";
import type { Platform, ProjectDTO, TemplateDTO } from "@/lib/types";
import { ProjectCard } from "../project-card";
import { ProjectFormModal } from "../project-form";
import { Button, ConfirmDialog, EmptyState, Input, PageHeader, Segmented, Select } from "../ui";

export function ProjectsView({ initial, templates, openNew }: { initial: ProjectDTO[]; templates: TemplateDTO[]; openNew: boolean }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [pending, setPending] = useState<string[]>([]);
  const [modal, setModal] = useState<{ project: ProjectDTO | null } | null>(openNew ? { project: null } : null);
  const [toDelete, setToDelete] = useState<ProjectDTO | null>(null);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [sort, setSort] = useState<"updated" | "name" | "created">("updated");

  const filtered = useMemo(() => {
    const list = projects.filter(
      (p) =>
        (platform === "all" || p.platforms === platform || p.platforms === "both") &&
        (!q || `${p.name} ${p.tagline} ${p.bundleId}`.toLowerCase().includes(q.toLowerCase())),
    );
    return [...list].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt)));
  }, [projects, q, platform, sort]);

  const closeModal = () => {
    setModal(null);
    if (openNew) router.replace("/projects");
  };

  const duplicate = async (p: ProjectDTO) => {
    const tempId = `temp-${Date.now()}`;
    const temp: ProjectDTO = { ...p, id: tempId, name: `${p.name} copy`, updatedAt: new Date().toISOString() };
    setProjects((list) => [temp, ...list]);
    setPending((x) => [...x, tempId]);
    try {
      const created = await api<ProjectDTO>(`projects/${p.id}/duplicate`, { method: "POST" });
      setProjects((list) => list.map((x) => (x.id === tempId ? { ...created, screenshotCount: p.screenshotCount, videoCount: p.videoCount, previewSpecs: p.previewSpecs } : x)));
      toast.success(`Duplicated ${p.name}`);
      router.refresh();
    } catch (e) {
      setProjects((list) => list.filter((x) => x.id !== tempId));
      toast.error(errMsg(e));
    } finally {
      setPending((x) => x.filter((id) => id !== tempId));
    }
  };

  const remove = async (p: ProjectDTO) => {
    const snapshot = projects;
    setProjects((list) => list.filter((x) => x.id !== p.id));
    try {
      await api(`projects/${p.id}`, { method: "DELETE" });
      toast.success(`Deleted ${p.name}`);
      router.refresh();
    } catch (e) {
      setProjects(snapshot);
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Each project is one app — its screenshot sets, device frames and preview videos."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setModal({ project: null })}>
            New project
          </Button>
        }
      />
      {projects.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, tagline or bundle ID" className="pl-9" />
          </div>
          <Segmented
            value={platform}
            onChange={setPlatform}
            options={[
              { value: "all", label: "All" },
              { value: "ios", label: "iOS" },
              { value: "android", label: "Android" },
            ]}
          />
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="sm:w-44">
            <option value="updated">Recently edited</option>
            <option value="created">Newest</option>
            <option value="name">Name A–Z</option>
          </Select>
        </div>
      )}
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Create a project for your app, pick a template and we’ll generate three starter screenshots you can customize."
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => setModal({ project: null })}>
              Create your first project
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search />} title="No matching projects" description="Try a different search or platform filter." action={<Button onClick={() => { setQ(""); setPlatform("all"); }}>Clear filters</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              pending={pending.includes(p.id)}
              onEdit={() => setModal({ project: p })}
              onDuplicate={() => duplicate(p)}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </div>
      )}
      {modal && (
        <ProjectFormModal
          open
          onClose={closeModal}
          project={modal.project}
          templates={templates}
          onSaved={(p, isNew) => {
            if (isNew) {
              setProjects((list) => [{ ...p, screenshotCount: 3, videoCount: 0, previewSpecs: [] }, ...list]);
              setPending((x) => [...x, p.id]);
              router.push(`/projects/${p.id}`);
              router.refresh();
            } else {
              setProjects((list) => list.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
              router.refresh();
            }
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="All screenshots and preview videos in this project will be permanently deleted. Exported files stay in your library."
        onConfirm={() => (toDelete ? remove(toDelete) : undefined)}
      />
    </div>
  );
}
