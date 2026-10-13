"use client";

import { Apple, Copy, Film, Images, Pencil, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { defaultPreviewSize } from "@/lib/catalog";
import { timeAgo } from "@/lib/export-paths";
import type { Platform, ProjectDTO } from "@/lib/types";
import { ShotCanvas } from "./shot-canvas";
import { Badge, cn, Menu, Spinner } from "./ui";

export function AppIcon({ name, c1, c2, size = 40, className }: { name: string; c1: string; c2: string; size?: number; className?: string }) {
  return (
    <div
      className={cn("grid shrink-0 place-items-center font-bold text-white shadow-lg ring-1 ring-white/15", className)}
      style={{ width: size, height: size, borderRadius: size * 0.24, background: `linear-gradient(135deg, ${c1}, ${c2})`, fontSize: size * 0.45 }}
    >
      {name.trim().slice(0, 1).toUpperCase() || "A"}
    </div>
  );
}

export function PlatformBadges({ platforms }: { platforms: Platform }) {
  return (
    <div className="flex gap-1">
      {platforms !== "android" && (
        <Badge tone="neutral">
          <Apple className="size-3" /> iOS
        </Badge>
      )}
      {platforms !== "ios" && (
        <Badge tone="green">
          <Smartphone className="size-3" /> Android
        </Badge>
      )}
    </div>
  );
}

export function ProjectCard({
  project,
  pending,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  project: ProjectDTO;
  pending?: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const specs = project.previewSpecs ?? [];
  const size = defaultPreviewSize(project.platforms);
  const content = (
    <div className={cn("group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition hover:border-white/15 hover:bg-white/[0.035]", pending && "pointer-events-none opacity-60")}>
      <div className="relative h-48 overflow-hidden border-b border-white/[0.05]" style={{ background: `radial-gradient(circle at 50% 120%, ${project.primaryColor}55, transparent 70%)` }}>
        {specs.length === 0 ? (
          <div className="grid h-full place-items-center text-xs text-zinc-500">No screenshots yet</div>
        ) : (
          <div className="absolute inset-x-0 top-5 flex justify-center">
            {specs.map((s, i) => (
              <div
                key={i}
                className="w-[92px] shrink-0 transition-transform duration-300 group-hover:-translate-y-1"
                style={{ transform: `rotate(${(i - (specs.length - 1) / 2) * 7}deg) translateY(${Math.abs(i - (specs.length - 1) / 2) * 10}px)`, marginLeft: i ? -18 : 0, zIndex: i === 1 ? 2 : 1 }}
              >
                <ShotCanvas spec={s} sizeId={size} appName={project.name} brandColor={project.primaryColor} panorama={{ index: i, count: project.screenshotCount ?? specs.length }} className="shadow-xl shadow-black/50 ring-1 ring-white/10" rounded />
              </div>
            ))}
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 grid place-items-center bg-black/30">
            <Spinner className="size-6" />
          </div>
        )}
      </div>
      <div className="flex items-start gap-3 p-4">
        <AppIcon name={project.name} c1={project.primaryColor} c2={project.accentColor} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white">{project.name}</h3>
          </div>
          <p className="truncate text-xs text-zinc-400">{project.tagline || project.category}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <PlatformBadges platforms={project.platforms} />
            <span className="inline-flex items-center gap-1">
              <Images className="size-3" /> {project.screenshotCount ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Film className="size-3" /> {project.videoCount ?? 0}
            </span>
            <span>· {timeAgo(project.updatedAt)}</span>
          </div>
        </div>
        {(onEdit || onDelete) && (
          <Menu
            items={[
              ...(onEdit ? [{ label: "Edit details", icon: <Pencil />, onClick: onEdit }] : []),
              ...(onDuplicate ? [{ label: "Duplicate", icon: <Copy />, onClick: onDuplicate }] : []),
              ...(onDelete ? [{ label: "Delete", icon: <Trash2 />, onClick: onDelete, danger: true }] : []),
            ]}
          />
        )}
      </div>
    </div>
  );
  if (pending) return content;
  return (
    <Link href={`/projects/${project.id}`} className="block focus:outline-none">
      {content}
    </Link>
  );
}
