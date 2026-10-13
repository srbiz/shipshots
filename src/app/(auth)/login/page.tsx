import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/server/auth";
import { ensureSeeded } from "@/lib/server/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  await ensureSeeded();
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
