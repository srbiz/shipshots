import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScreenshotEditor } from "@/components/views/screenshot-editor";
import { requireUser } from "@/lib/server/auth";
import { getProjectDetail, listAssets, listTemplates } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Screenshot editor" };

export default async function ScreenshotEditorPage({ params }: { params: Promise<{ id: string; shotId: string }> }) {
  const user = await requireUser();
  const { id, shotId } = await params;
  const detail = await getProjectDetail(user.id, id).catch(() => null);
  if (!detail || !detail.screenshots.some((s) => s.id === shotId)) notFound();
  const [templates, assets] = await Promise.all([listTemplates(user.id), listAssets(user.id)]);
  return <ScreenshotEditor project={detail.project} initialShots={detail.screenshots} initialId={shotId} templates={templates} initialAssets={assets} />;
}
