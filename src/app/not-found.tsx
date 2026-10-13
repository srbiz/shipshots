import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-grid grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/25 to-cyan-400/10 text-indigo-300 ring-1 ring-inset ring-white/10">
          <Compass className="size-6" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">This screen isn’t in the build</h1>
        <p className="mt-2 text-sm text-zinc-400">The project, screenshot or video you’re looking for doesn’t exist or was deleted.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/dashboard" className="inline-flex h-9 items-center rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white hover:bg-indigo-400">
            Go to dashboard
          </Link>
          <Link href="/projects" className="inline-flex h-9 items-center rounded-lg bg-white/[0.06] px-4 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.1]">
            All projects
          </Link>
        </div>
      </div>
    </main>
  );
}
