import type { OutputSize } from "./catalog";

export type ZipLayout = "flat" | "fastlane";

export function slugify(s: string, fallback = "untitled"): string {
  const v = s
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return v || fallback;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Returns the archive path for a rendered screenshot, or null when the size only needs one image
 * (the Google Play feature graphic). The `fastlane` layout is directly consumable by
 * `fastlane deliver` (App Store) and `fastlane supply` (Google Play).
 */
export function exportPath(layout: ZipLayout, size: OutputSize, index: number, headline: string, ext: string, locale = "en-US"): string | null {
  if (size.id === "play-feature" && index > 0) return null;
  if (layout === "flat") return `${size.store}/${size.id}/${pad2(index + 1)}-${slugify(headline, "screenshot")}.${ext}`;
  if (size.store === "app-store") return `fastlane/screenshots/${locale}/${pad2(index + 1)}_${size.id}.${ext}`;
  const base = `fastlane/metadata/android/${locale}/images`;
  if (size.id === "play-feature") return `${base}/featureGraphic.${ext}`;
  const dir = size.family === "android-tablet" ? (size.id === "android-tablet-7" ? "sevenInchScreenshots" : "tenInchScreenshots") : "phoneScreenshots";
  return `${base}/${dir}/${index + 1}_${size.id}.${ext}`;
}

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
