import type { Metadata } from "next";
import { TemplatesView } from "@/components/views/templates-view";
import { requireUser } from "@/lib/server/auth";
import { listProjects, listTemplates } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const [templates, projects] = await Promise.all([listTemplates(user.id), listProjects(user.id)]);
  return <TemplatesView initial={templates} projects={projects.map((p) => ({ id: p.id, name: p.name, platforms: p.platforms }))} />;
}
