import type { Metadata } from "next";
import { ExportsView } from "@/components/views/exports-view";
import { requireUser } from "@/lib/server/auth";
import { listExports, listProjects } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Exports" };

export default async function ExportsPage() {
  const user = await requireUser();
  const [exports, projects] = await Promise.all([listExports(user.id), listProjects(user.id)]);
  return <ExportsView initial={exports} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />;
}
