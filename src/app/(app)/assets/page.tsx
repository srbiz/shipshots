import type { Metadata } from "next";
import { AssetsView } from "@/components/views/assets-view";
import { requireUser } from "@/lib/server/auth";
import { listAssets, listProjects } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Media library" };

export default async function AssetsPage() {
  const user = await requireUser();
  const [assets, projects] = await Promise.all([listAssets(user.id), listProjects(user.id)]);
  return <AssetsView initial={assets} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />;
}
