import type { Metadata } from "next";
import { AgentView } from "@/components/views/agent-view";
import { requireUser } from "@/lib/server/auth";
import { listKeys, listProjects } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agent API" };

export default async function AgentPage() {
  const user = await requireUser();
  const [keys, projects] = await Promise.all([listKeys(user.id), listProjects(user.id)]);
  return <AgentView initialKeys={keys} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />;
}
