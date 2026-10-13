import { desc, eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/server/auth";
import { ensureSeeded } from "@/lib/server/seed";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const user = await requireUser();
  const list = await db
    .select({ id: projects.id, name: projects.name, primaryColor: projects.primaryColor, accentColor: projects.accentColor })
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.updatedAt))
    .limit(8);
  return (
    <AppShell user={{ name: user.name, email: user.email }} projects={list}>
      {children}
    </AppShell>
  );
}
