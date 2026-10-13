import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/views/project-view";
import { requireUser } from "@/lib/server/auth";
import { getProjectDetail, listTemplates } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getProjectDetail(user.id, id).catch(() => null);
  if (!detail) notFound();
  const templates = await listTemplates(user.id);
  return <ProjectView initial={detail} templates={templates} initialTab={sp.tab === "videos" ? "videos" : "screenshots"} />;
}
