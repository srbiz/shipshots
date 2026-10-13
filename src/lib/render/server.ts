import path from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { FONT_FILES, getOutputSize } from "../catalog";
import type { MockKind, ScreenshotSpec } from "../types";
import type { Ctx, ImageMap } from "./canvas-utils";
import { renderScreenshot } from "./engine";
import { drawMock } from "./mocks";

let registered = false;

export function ensureServerFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "public", "fonts");
  for (const f of FONT_FILES) {
    try {
      GlobalFonts.registerFromPath(path.join(dir, f.file), f.family);
    } catch (e) {
      console.error("[render] failed to register font", f.file, e);
    }
  }
  registered = true;
}

export async function decodeImages(bufs: Record<string, Buffer>): Promise<ImageMap> {
  const out: ImageMap = {};
  for (const [id, buf] of Object.entries(bufs)) {
    try {
      out[id] = await loadImage(buf);
    } catch {
      out[id] = null;
    }
  }
  return out;
}

export async function renderScreenshotBuffer(
  spec: ScreenshotSpec,
  sizeId: string,
  opts: {
    images: ImageMap;
    appName: string;
    brandColor: string;
    panorama?: { index: number; count: number };
    format: "png" | "jpeg";
    quality?: number;
  },
): Promise<{ buffer: Buffer; width: number; height: number; mime: string }> {
  ensureServerFonts();
  const size = getOutputSize(sizeId);
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  renderScreenshot(ctx, spec, {
    width: size.width,
    height: size.height,
    family: size.family,
    images: opts.images,
    appName: opts.appName,
    brandColor: opts.brandColor,
    panorama: opts.panorama,
  });
  const buffer = opts.format === "jpeg" ? await canvas.encode("jpeg", opts.quality ?? 92) : await canvas.encode("png");
  return { buffer, width: size.width, height: size.height, mime: opts.format === "jpeg" ? "image/jpeg" : "image/png" };
}

/** Renders one of the mock app screens as a "simulator capture" PNG (used for seeding demo assets). */
export async function renderMockPng(
  mock: MockKind,
  dark: boolean,
  accent: string,
  width: number,
  height: number,
  opts: { platform: "ios" | "android"; tablet?: boolean; appName: string },
): Promise<Buffer> {
  ensureServerFonts();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  drawMock(ctx, mock, 0, 0, width, height, {
    dark,
    accent,
    platform: opts.platform,
    tablet: !!opts.tablet,
    classic: false,
    statusBar: true,
    progress: 1,
    appName: opts.appName,
    time: 0,
  });
  return canvas.encode("png");
}
