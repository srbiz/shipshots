import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VideoEditor } from "@/components/views/video-editor";
import { requireUser } from "@/lib/server/auth";
import { getProjectDetail } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview video" };

export default async function VideoEditorPage({ params }: { params: Promise<{ id: string; videoId: string }> }) {
  const user = await requireUser();
  const { id, videoId } = await params;
  const detail = await getProjectDetail(user.id, id).catch(() => null);
  const video = detail?.videos.find((v) => v.id === videoId);
  if (!detail || !video) notFound();
  return <VideoEditor project={detail.project} shots={detail.screenshots} initial={video} />;
}
