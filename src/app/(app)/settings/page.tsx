import type { Metadata } from "next";
import { SettingsView } from "@/components/views/settings-view";
import { requireUser } from "@/lib/server/auth";
import { getStats } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const stats = await getStats(user.id);
  return <SettingsView user={{ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() }} stats={stats} />;
}
