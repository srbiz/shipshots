"use client";

import { useEffect, useRef, useState } from "react";
import { getOutputSize } from "@/lib/catalog";
import type { ImageMap } from "@/lib/render/canvas-utils";
import { ensureFonts, loadImagesFor } from "@/lib/render/client";
import { renderScreenshot } from "@/lib/render/engine";
import { collectAssetIds, type ScreenshotSpec } from "@/lib/types";
import { cn } from "./ui";

/** Live, resolution-independent preview of a screenshot spec (same renderer used for export). */
export function ShotCanvas({
  spec,
  sizeId,
  appName = "Shipyard",
  brandColor,
  panorama,
  className,
  rounded = true,
}: {
  spec: ScreenshotSpec;
  sizeId: string;
  appName?: string;
  brandColor?: string;
  panorama?: { index: number; count: number };
  className?: string;
  rounded?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [images, setImages] = useState<ImageMap>({});
  const size = getOutputSize(sizeId);
  const assetKey = collectAssetIds(spec).join(",");
  const pIndex = panorama?.index ?? 0;
  const pCount = panorama?.count ?? 1;

  useEffect(() => {
    let alive = true;
    ensureFonts().then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!assetKey) return;
    let alive = true;
    loadImagesFor([spec]).then((m) => alive && setImages(m));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !width || !fontsReady) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round((pw * size.height) / size.width));
    if (c.width !== pw) c.width = pw;
    if (c.height !== ph) c.height = ph;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const s = pw / size.width;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    renderScreenshot(ctx, spec, {
      width: size.width,
      height: size.height,
      family: size.family,
      images,
      appName,
      brandColor,
      panorama: { index: pIndex, count: pCount },
      pxScale: s,
    });
  }, [spec, width, fontsReady, images, size, appName, brandColor, pIndex, pCount]);

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full overflow-hidden bg-zinc-900", rounded && "rounded-xl", className)}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {!fontsReady && <div className="skeleton absolute inset-0" />}
    </div>
  );
}
