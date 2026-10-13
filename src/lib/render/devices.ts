import type { ResolvedDevice } from "../types";
import { circle, Ctx, darken, fillRR, lighten, rr, strokeRR } from "./canvas-utils";

export interface DeviceGeom {
  w: number;
  h: number;
  r: number;
  bezel: number;
  screen: { x: number; y: number; w: number; h: number; r: number };
}

interface DeviceSpec {
  aspect: number; // screen width / height
  bezel: number; // relative to body width
  radius: number;
  screenRadius: number;
  top?: number;
  bottom?: number;
}

const SPECS: Record<ResolvedDevice, DeviceSpec> = {
  iphone: { aspect: 1206 / 2622, bezel: 0.034, radius: 0.165, screenRadius: 0.135 },
  "iphone-classic": { aspect: 1242 / 2208, bezel: 0.055, radius: 0.15, screenRadius: 0.004, top: 0.2, bottom: 0.2 },
  ipad: { aspect: 2064 / 2752, bezel: 0.042, radius: 0.065, screenRadius: 0.032 },
  pixel: { aspect: 1280 / 2856, bezel: 0.032, radius: 0.13, screenRadius: 0.105 },
  galaxy: { aspect: 1080 / 2340, bezel: 0.024, radius: 0.085, screenRadius: 0.07 },
  "android-tablet": { aspect: 1600 / 2560, bezel: 0.048, radius: 0.055, screenRadius: 0.026 },
  none: { aspect: 1206 / 2622, bezel: 0, radius: 0.1, screenRadius: 0.1 },
};

export function screenAspect(kind: ResolvedDevice): number {
  return SPECS[kind].aspect;
}

export function deviceGeometry(kind: ResolvedDevice, width: number, aspectOverride?: number): DeviceGeom {
  const s = SPECS[kind];
  const aspect = aspectOverride ?? s.aspect;
  const b = s.bezel * width;
  const top = (s.top ?? s.bezel) * width;
  const bottom = (s.bottom ?? s.bezel) * width;
  const sw = width - 2 * b;
  const sh = sw / aspect;
  const screenR = kind === "none" ? Math.min(width * 0.1, sw * 0.1) : s.screenRadius * width;
  return { w: width, h: sh + top + bottom, r: s.radius * width, bezel: b, screen: { x: b, y: top, w: sw, h: sh, r: screenR } };
}

export function bodyAspect(kind: ResolvedDevice, aspectOverride?: number): number {
  const g = deviceGeometry(kind, 1000, aspectOverride);
  return g.w / g.h;
}

function drawButtons(ctx: Ctx, kind: ResolvedDevice, g: DeviceGeom, frameColor: string) {
  const { w, h } = g;
  const t = w * 0.011;
  const col = darken(frameColor, 0.18);
  const btn = (side: "l" | "r", y0: number, len: number) => {
    const x = side === "l" ? -t : w - w * 0.01;
    fillRR(ctx, x, y0 * h, t + w * 0.01, len * h, t * 0.6, col);
  };
  if (kind === "iphone") {
    btn("l", 0.17, 0.035);
    btn("l", 0.235, 0.065);
    btn("l", 0.32, 0.065);
    btn("r", 0.27, 0.1);
  } else if (kind === "iphone-classic") {
    btn("l", 0.13, 0.035);
    btn("l", 0.2, 0.055);
    btn("l", 0.27, 0.055);
    btn("r", 0.2, 0.065);
  } else if (kind === "pixel") {
    btn("r", 0.2, 0.06);
    btn("r", 0.3, 0.12);
  } else if (kind === "galaxy") {
    btn("r", 0.22, 0.1);
    btn("r", 0.35, 0.055);
  } else if (kind === "ipad" || kind === "android-tablet") {
    btn("r", 0.08, 0.05);
    btn("r", 0.15, 0.05);
  }
}

/**
 * Draws a device whose top-left is at the current origin.
 * `pxScale` compensates shadowBlur (not affected by transforms) for scaled previews.
 */
export function drawDevice(
  ctx: Ctx,
  kind: ResolvedDevice,
  g: DeviceGeom,
  frameColor: string,
  shadow: boolean,
  pxScale: number,
  drawScreen: (x: number, y: number, w: number, h: number) => void,
) {
  const { w, h, r } = g;
  const sc = g.screen;
  ctx.save();
  if (kind === "none") {
    if (shadow) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.38)";
      ctx.shadowBlur = w * 0.1 * pxScale;
      ctx.shadowOffsetY = w * 0.04 * pxScale;
      fillRR(ctx, 0, 0, w, h, sc.r, "#000");
      ctx.restore();
    }
    ctx.save();
    rr(ctx, 0, 0, w, h, sc.r);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    drawScreen(0, 0, w, h);
    ctx.restore();
    strokeRR(ctx, 0, 0, w, h, sc.r, "rgba(255,255,255,0.14)", Math.max(1, w * 0.004));
    ctx.restore();
    return;
  }

  drawButtons(ctx, kind, g, frameColor);

  if (shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = w * 0.11 * pxScale;
    ctx.shadowOffsetY = w * 0.045 * pxScale;
    fillRR(ctx, 0, 0, w, h, r, frameColor);
    ctx.restore();
  }

  // Metallic frame
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, darken(frameColor, 0.3));
  grad.addColorStop(0.035, lighten(frameColor, 0.3));
  grad.addColorStop(0.1, frameColor);
  grad.addColorStop(0.9, frameColor);
  grad.addColorStop(0.965, lighten(frameColor, 0.25));
  grad.addColorStop(1, darken(frameColor, 0.35));
  fillRR(ctx, 0, 0, w, h, r, grad);

  // Glass front
  const inset = w * (kind === "iphone-classic" ? 0.01 : 0.008);
  const face = kind === "iphone-classic" && lighten(frameColor, 0) !== frameColor ? "#050506" : "#050506";
  fillRR(ctx, inset, inset, w - inset * 2, h - inset * 2, Math.max(0, r - inset), face);

  // Screen
  ctx.save();
  rr(ctx, sc.x, sc.y, sc.w, sc.h, sc.r);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
  drawScreen(sc.x, sc.y, sc.w, sc.h);
  const gl = ctx.createLinearGradient(sc.x, sc.y, sc.x + sc.w, sc.y + sc.h * 0.6);
  gl.addColorStop(0, "rgba(255,255,255,0.07)");
  gl.addColorStop(0.4, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
  ctx.restore();

  // Cut-outs & hardware details
  if (kind === "iphone") {
    const diW = sc.w * 0.3;
    const diH = sc.w * 0.088;
    const diY = sc.y + sc.w * 0.03;
    fillRR(ctx, sc.x + (sc.w - diW) / 2, diY, diW, diH, diH / 2, "#000");
    circle(ctx, sc.x + sc.w / 2 + diW * 0.3, diY + diH / 2, diH * 0.2, "#0c1222");
  } else if (kind === "pixel" || kind === "galaxy") {
    const cr = sc.w * (kind === "pixel" ? 0.026 : 0.021);
    const cy = sc.y + sc.w * 0.05;
    circle(ctx, sc.x + sc.w / 2, cy, cr, "#000");
    circle(ctx, sc.x + sc.w / 2, cy, cr * 0.42, "#141a28");
  } else if (kind === "iphone-classic") {
    fillRR(ctx, w / 2 - w * 0.09, sc.y * 0.46, w * 0.18, w * 0.02, w * 0.01, "#1d1d20");
    circle(ctx, w / 2 - w * 0.17, sc.y * 0.5, w * 0.017, "#15171d");
    const hy = sc.y + sc.h + (h - sc.y - sc.h) / 2;
    circle(ctx, w / 2, hy, w * 0.075, "#0d0d0f");
    ctx.beginPath();
    ctx.arc(w / 2, hy, w * 0.075, 0, Math.PI * 2);
    ctx.strokeStyle = "#2c2c30";
    ctx.lineWidth = w * 0.006;
    ctx.stroke();
  } else if (kind === "ipad" || kind === "android-tablet") {
    circle(ctx, w / 2, sc.y / 2, w * 0.006, "#1a1d26");
  }
  ctx.restore();
}
