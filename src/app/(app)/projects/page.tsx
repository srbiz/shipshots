import type { Metadata } from "next";
import { ProjectsView } from "@/components/views/projects-view";
import { requireUser } from "@/lib/server/auth";
import { listProjects, listTemplates } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [projects, templates] = await Promise.all([listProjects(user.id), listTemplates(user.id)]);
  // keyed so that navigating to ?new=1 while already on /projects remounts and opens the dialog
  return <ProjectsView key={sp.new === "1" ? "new" : "list"} initial={projects} templates={templates} openNew={sp.new === "1"} />;
}
