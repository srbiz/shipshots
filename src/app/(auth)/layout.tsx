import type { ReactNode } from "react";
import { Logo } from "@/components/app-shell";
import { AuthShowcase } from "@/components/auth-showcase";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
        <p className="text-xs text-zinc-600">Local studio · your data stays in your Postgres</p>
      </div>
      <div className="hidden border-l border-white/[0.06] bg-[#0c0d13] lg:block">
        <AuthShowcase />
      </div>
    </div>
  );
}
