// Browser-only helpers for the shared canvas renderer.
import { FONT_FILES, getOutputSize } from "../catalog";
import { collectAssetIds, type ScreenshotSpec } from "../types";
import type { Ctx, ImageMap } from "./canvas-utils";
import { renderScreenshot } from "./engine";

let fontsPromise: Promise<void> | null = null;

export function ensureFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONT_FILES.map((f) => document.fonts.load(`${f.weight} 32px "${f.family}"`).catch(() => [])),
    ).then(() => undefined);
  }
  return fontsPromise;
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

export const assetUrl = (id: string) => `/api/v1/assets/${id}/file`;

export function loadAssetImage(id: string): Promise<HTMLImageElement | null> {
  let p = imageCache.get(id);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = assetUrl(id);
    });
    imageCache.set(id, p);
  }
  return p;
}

export async function loadImagesFor(specs: ScreenshotSpec[]): Promise<ImageMap> {
  const ids = [...new Set(specs.flatMap((s) => collectAssetIds(s)))];
  const entries = await Promise.all(ids.map(async (id) => [id, await loadAssetImage(id)] as const));
  return Object.fromEntries(entries);
}

export interface RenderParams {
  spec: ScreenshotSpec;
  sizeId: string;
  images: ImageMap;
  appName: string;
  brandColor: string;
  panorama?: { index: number; count: number };
}

export async function renderToBlob(p: RenderParams & { format: "png" | "jpeg"; quality?: number }): Promise<Blob> {
  await ensureFonts();
  const size = getOutputSize(p.sizeId);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d") as Ctx;
  renderScreenshot(ctx, p.spec, {
    width: size.width,
    height: size.height,
    family: size.family,
    images: p.images,
    appName: p.appName,
    brandColor: p.brandColor,
    panorama: p.panorama,
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))),
      p.format === "jpeg" ? "image/jpeg" : "image/png",
      p.quality ?? 0.92,
    ),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function uploadExport(
  blob: Blob,
  info: { name: string; kind: "image" | "video" | "archive"; projectId?: string; width?: number; height?: number; durationSec?: number; meta?: Record<string, unknown> },
) {
  const q = new URLSearchParams({ name: info.name, kind: info.kind });
  if (info.projectId) q.set("projectId", info.projectId);
  if (info.width) q.set("width", String(info.width));
  if (info.height) q.set("height", String(info.height));
  if (info.durationSec) q.set("duration", String(info.durationSec));
  if (info.meta) q.set("meta", JSON.stringify(info.meta));
  const res = await fetch(`/api/v1/exports?${q.toString()}`, {
    method: "POST",
    body: blob,
    headers: { "content-type": blob.type || "application/octet-stream", "x-requested-with": "shipshots" },
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Upload failed");
  }
  return res.json();
}
