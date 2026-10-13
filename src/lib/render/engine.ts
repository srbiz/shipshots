import { FAMILY_DEFAULT_DEVICE, FONTS, type FontDef } from "../catalog";
import type {
  Background,
  DeviceFamily,
  FontKey,
  MotionKind,
  ResolvedDevice,
  ScreenSource,
  ScreenshotSpec,
  TransitionKind,
} from "../types";
import { DEFAULT_SPEC } from "../types";
import {
  clamp,
  Ctx,
  darken,
  drawImageCover,
  drawRich,
  drawSpaced,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  fillRR,
  fontStr,
  hash,
  ImageMap,
  layoutRich,
  lighten,
  Line,
  measureSpaced,
  rgba,
  rr,
  star,
  strokeRR,
  wrapPlain,
} from "./canvas-utils";
import { bodyAspect, deviceGeometry, drawDevice, type DeviceGeom } from "./devices";
import { drawMock, drawPlaceholder } from "./mocks";

export interface SceneAnim {
  text: number;
  device: number;
  zoom: number;
  panX: number;
  floatY: number;
  mock: number;
  scroll: number;
}
export const STATIC_ANIM: SceneAnim = { text: 1, device: 1, zoom: 1, panX: 0, floatY: 0, mock: 1, scroll: 0 };

export interface RenderOptions {
  width: number;
  height: number;
  family: DeviceFamily;
  images?: ImageMap;
  appName?: string;
  brandColor?: string;
  panorama?: { index: number; count: number };
  anim?: SceneAnim;
  pxScale?: number;
  time?: number;
}

interface Env {
  ctx: Ctx;
  spec: ScreenshotSpec;
  o: RenderOptions;
  W: number;
  H: number;
  unit: number;
  pad: number;
  fd: FontDef;
  anim: SceneAnim;
  px: number;
  device: ResolvedDevice;
}

export function resolveDevice(spec: ScreenshotSpec, family: DeviceFamily): ResolvedDevice {
  return spec.device === "auto" ? FAMILY_DEFAULT_DEVICE[family] : spec.device;
}

export function resolveScreen(spec: ScreenshotSpec, family: DeviceFamily, which: "primary" | "secondary" = "primary"): ScreenSource {
  if (which === "secondary") return spec.screen2;
  if ((family === "android" || family === "android-tablet") && spec.overrides.android) return spec.overrides.android;
  if (family === "ipad" && spec.overrides.ipad) return spec.overrides.ipad;
  return spec.screen;
}

const isAndroidDevice = (d: ResolvedDevice) => d === "pixel" || d === "galaxy" || d === "android-tablet";

// ---------------- Background ----------------
function blob(ctx: Ctx, x: number, y: number, r: number, col: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.55, rgba(col, a * 0.45));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function drawBackground(ctx: Ctx, bg: Background, W: number, H: number, pano?: { index: number; count: number }) {
  const cols = bg.colors.length ? bg.colors : ["#0F172A", "#6366F1"];
  const c0 = cols[0];
  const c1 = cols[1] ?? lighten(c0, 0.2);
  const count = Math.max(1, pano?.count ?? 1);
  const idx = pano?.index ?? 0;
  const GW = W * count;
  const M = Math.max(W, H);
  ctx.save();
  ctx.translate(-idx * W, 0);
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, GW, H);
  switch (bg.type) {
    case "linear": {
      const a = ((bg.angle - 90) * Math.PI) / 180;
      const cx = GW / 2;
      const cy = H / 2;
      const len = Math.abs(GW * Math.cos(a)) / 2 + Math.abs(H * Math.sin(a)) / 2;
      const g = ctx.createLinearGradient(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      cols.forEach((c, i) => g.addColorStop(i / Math.max(1, cols.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GW, H);
      break;
    }
    case "radial": {
      for (let i = 0; i < count; i++) blob(ctx, i * W + W / 2, H * 0.4, M * 0.75, c1, 0.95);
      if (cols[2]) blob(ctx, GW * 0.9, H * 0.95, M * 0.5, cols[2], 0.5);
      break;
    }
    case "mesh": {
      const accents = cols.length > 1 ? cols.slice(1) : [c1];
      if (!pano) {
        const spots: [number, number, number][] = [[0.1, 0.06, 0.6], [0.95, 0.3, 0.55], [0.15, 0.68, 0.62], [0.9, 0.92, 0.6], [0.55, 0.42, 0.32]];
        spots.forEach(([x, y, r], i) => blob(ctx, x * W, y * H, r * M, accents[i % accents.length], i === 4 ? 0.35 : 0.8));
      } else {
        for (let i = 0; i * W * 0.62 < GW + W; i++) {
          blob(ctx, (i * 0.62 + 0.15) * W, H * (0.1 + 0.8 * hash(i + 3)), M * (0.42 + 0.22 * hash(i + 11)), accents[i % accents.length], 0.75);
        }
      }
      break;
    }
    case "grid": {
      blob(ctx, GW / 2, -H * 0.05, M * 0.8, c1, 0.4);
      const step = Math.min(W, H * 0.5) * 0.075;
      ctx.strokeStyle = rgba(c1, 0.14);
      ctx.lineWidth = Math.max(1, step * 0.025);
      ctx.beginPath();
      for (let x = 0; x <= GW; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let y = 0; y <= H; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(GW, y);
      }
      ctx.stroke();
      const fade = ctx.createLinearGradient(0, H * 0.4, 0, H);
      fade.addColorStop(0, rgba(c0, 0));
      fade.addColorStop(1, rgba(c0, 0.85));
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, GW, H);
      break;
    }
    case "dots": {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, c0);
      g.addColorStop(1, cols[2] ?? (luma(c0) ? darken(c0, 0.06) : lighten(c0, 0.06)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GW, H);
      const step = Math.min(W, H * 0.5) * 0.055;
      const r = step * 0.085;
      ctx.fillStyle = rgba(c1, 0.32);
      for (let y = step / 2; y < H; y += step) {
        for (let x = step / 2; x < GW; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      blob(ctx, GW * 0.5, H * 0.3, M * 0.6, c1, 0.18);
      break;
    }
    default:
      break;
  }
  if (pano && count > 1) {
    // Continuous ribbon that flows across every screenshot in the set
    const amp = H * 0.07;
    const mid = H * 0.6;
    const thick = H * 0.06;
    ctx.beginPath();
    const stepX = W / 30;
    for (let x = 0; x <= GW + stepX; x += stepX) {
      const y = mid + Math.sin((x / W) * 2.1) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let x = GW + stepX; x >= 0; x -= stepX) {
      ctx.lineTo(x, mid + Math.sin((x / W) * 2.1) * amp + thick + Math.sin((x / W) * 1.3) * thick * 0.5);
    }
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, 0, GW, 0);
    const rc = cols.length > 1 ? cols.slice(1) : [c1];
    rc.forEach((c, i) => rg.addColorStop(i / Math.max(1, rc.length - 1), rgba(c, 0.55)));
    ctx.fillStyle = rg;
    ctx.fill();
  }
  ctx.restore();
}
function luma(hex: string) {
  const v = parseInt((hex || "#000000").slice(1), 16);
  return ((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114 > 140;
}

// ---------------- Text ----------------
interface TextBlock {
  eyebrow: { text: string; fs: number; w: number; h: number } | null;
  head: Line[];
  hfs: number;
  hlh: number;
  sub: Line[];
  sfs: number;
  slh: number;
  gapE: number;
  gapS: number;
  height: number;
}

function measureBlock(env: Env, maxW: number, scale = 1): TextBlock {
  const { ctx, spec, unit, fd } = env;
  const base = unit * 0.082 * spec.headlineScale * scale;
  let hfs = base;
  let head: Line[] = [];
  for (let i = 0; i < 8; i++) {
    ctx.font = fontStr(fd.headlineWeight, hfs, fd.family);
    head = spec.headline.trim() ? layoutRich(ctx, spec.headline.trim(), maxW) : [];
    if (head.length <= 3) break;
    hfs *= 0.9;
  }
  const hlh = hfs * fd.lineHeight;
  const sfs = unit * 0.038 * Math.min(1.15, scale);
  ctx.font = fontStr(fd.bodyWeight, sfs, fd.bodyFamily);
  const sub = spec.subheadline.trim() ? layoutRich(ctx, spec.subheadline.trim(), maxW) : [];
  const slh = sfs * 1.38;
  let eyebrow: TextBlock["eyebrow"] = null;
  if (spec.eyebrow.trim()) {
    const efs = unit * 0.029;
    const text = spec.eyebrowStyle === "stars" ? spec.eyebrow.trim() : spec.eyebrow.trim().toUpperCase();
    let w: number;
    if (spec.eyebrowStyle === "stars") {
      ctx.font = fontStr(600, efs * 1.05, fd.bodyFamily);
      w = 5 * efs * 1.45 + efs * 0.5 + ctx.measureText(text).width;
    } else {
      ctx.font = fontStr(700, efs, fd.bodyFamily);
      w = measureSpaced(ctx, text, efs * 0.14) + (spec.eyebrowStyle === "pill" ? efs * 2.1 : 0);
    }
    eyebrow = { text, fs: efs, w, h: spec.eyebrowStyle === "pill" ? efs * 2.3 : efs * 1.5 };
  }
  const gapE = eyebrow ? unit * 0.032 : 0;
  const gapS = sub.length && head.length ? hfs * 0.36 : 0;
  const height = (eyebrow ? eyebrow.h + gapE : 0) + head.length * hlh + gapS + sub.length * slh;
  return { eyebrow, head, hfs, hlh, sub, sfs, slh, gapE, gapS, height };
}

function drawBlock(env: Env, tb: TextBlock, x: number, y: number, maxW: number, align: "left" | "center") {
  const { ctx, spec, fd, anim } = env;
  if (anim.text <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(anim.text);
  ctx.translate(0, (1 - anim.text) * env.unit * 0.07);
  let cy = y;
  if (tb.eyebrow) {
    const e = tb.eyebrow;
    const ex = align === "center" ? x + (maxW - e.w) / 2 : x;
    if (spec.eyebrowStyle === "pill") {
      fillRR(ctx, ex, cy, e.w, e.h, e.h / 2, rgba(spec.accentColor, 0.16));
      strokeRR(ctx, ex, cy, e.w, e.h, e.h / 2, rgba(spec.accentColor, 0.5), Math.max(1, e.fs * 0.07));
      ctx.font = fontStr(700, e.fs, fd.bodyFamily);
      ctx.fillStyle = spec.accentColor;
      ctx.textAlign = "left";
      drawSpaced(ctx, e.text, ex + e.fs * 1.05, cy + e.h / 2 + e.fs * 0.36, e.fs * 0.14);
    } else if (spec.eyebrowStyle === "stars") {
      for (let i = 0; i < 5; i++) star(ctx, ex + e.fs * 0.65 + i * e.fs * 1.45, cy + e.h / 2, e.fs * 0.66, "#FBBF24");
      ctx.font = fontStr(600, e.fs * 1.05, fd.bodyFamily);
      ctx.fillStyle = rgba(spec.textColor, 0.85);
      ctx.textAlign = "left";
      ctx.fillText(e.text, ex + 5 * e.fs * 1.45 + e.fs * 0.5, cy + e.h / 2 + e.fs * 0.38);
    } else {
      ctx.font = fontStr(700, e.fs, fd.bodyFamily);
      ctx.fillStyle = spec.accentColor;
      ctx.textAlign = "left";
      drawSpaced(ctx, e.text, ex, cy + e.h / 2 + e.fs * 0.36, e.fs * 0.14);
    }
    cy += e.h + tb.gapE;
  }
  ctx.font = fontStr(fd.headlineWeight, tb.hfs, fd.family);
  drawRich(ctx, tb.head, x, cy, tb.hlh, tb.hfs, align, maxW, spec.textColor, spec.accentColor);
  cy += tb.head.length * tb.hlh + tb.gapS;
  ctx.font = fontStr(fd.bodyWeight, tb.sfs, fd.bodyFamily);
  drawRich(ctx, tb.sub, x, cy, tb.slh, tb.sfs, align, maxW, rgba(spec.textColor, 0.78), spec.accentColor);
  ctx.restore();
}

// ---------------- Device placement ----------------
function framelessAspect(env: Env, src: ScreenSource): number {
  if (src.kind === "asset") {
    const img = env.o.images?.[src.assetId];
    if (img && img.width && img.height) return img.width / img.height;
  }
  const f = env.o.family;
  return f === "ipad" ? 0.75 : f === "android-tablet" ? 0.625 : f === "iphone-classic" ? 0.5625 : f === "android" ? 0.47 : 1206 / 2622;
}
function aspectFor(env: Env, dev: ResolvedDevice, src: ScreenSource) {
  return bodyAspect(dev, dev === "none" ? framelessAspect(env, src) : undefined);
}

function drawScreenContent(env: Env, src: ScreenSource, dev: ResolvedDevice, x: number, y: number, w: number, h: number) {
  const { ctx, o, anim, spec } = env;
  if (src.kind === "asset") {
    const img = o.images?.[src.assetId];
    if (img) drawImageCover(ctx, img, x, y, w, h, anim.scroll);
    else drawPlaceholder(ctx, x, y, w, h);
    return;
  }
  const fam = o.family;
  const android = dev === "none" ? fam === "android" || fam === "android-tablet" : isAndroidDevice(dev);
  const tablet = dev === "ipad" || dev === "android-tablet" || (dev === "none" && (fam === "ipad" || fam === "android-tablet"));
  const classic = dev === "iphone-classic" || (dev === "none" && fam === "iphone-classic");
  drawMock(ctx, src.mock, x, y, w, h, {
    dark: src.dark,
    accent: o.brandColor ?? spec.accentColor,
    platform: android ? "android" : "ios",
    tablet,
    classic,
    statusBar: spec.showStatusBar,
    progress: anim.mock,
    appName: o.appName ?? "Shipyard",
    time: o.time ?? 0,
  });
}

function placeDevice(env: Env, p: { cx: number; top: number; width: number; rot?: number; src: ScreenSource; dev?: ResolvedDevice }): DeviceGeom {
  const { ctx, anim, spec } = env;
  const dev = p.dev ?? env.device;
  const g = deviceGeometry(dev, p.width, dev === "none" ? framelessAspect(env, p.src) : undefined);
  const dy = (1 - anim.device) * env.H * 0.45 + anim.floatY * env.H;
  const dx = anim.panX * env.W;
  ctx.save();
  ctx.translate(p.cx + dx, p.top + g.h / 2 + dy);
  if (p.rot) ctx.rotate((p.rot * Math.PI) / 180);
  ctx.translate(-g.w / 2, -g.h / 2);
  drawDevice(ctx, dev, g, spec.frameColor, spec.shadow, env.px, (x, y, w, h) => drawScreenContent(env, p.src, dev, x, y, w, h));
  ctx.restore();
  return g;
}

// ---------------- Layouts ----------------
function layoutTop(env: Env, opts: { frameless?: boolean; rot?: number; cx?: number; widthFactor?: number; textScale?: number; align?: "left" | "center" } = {}) {
  const { W, H, pad, unit, spec } = env;
  const maxW = W - pad * 2;
  const tb = measureBlock(env, maxW, opts.textScale ?? 1);
  const ty = H * 0.062;
  drawBlock(env, tb, pad, ty, maxW, opts.align ?? spec.textAlign);
  const src = resolveScreen(spec, env.o.family);
  const asp = aspectFor(env, env.device, src);
  const top = ty + tb.height + unit * 0.075 + spec.deviceOffset * H;
  const visible = Math.max(H - top, H * 0.3);
  const width = opts.frameless
    ? Math.min(W * 0.74, (visible - H * 0.045) * asp) * spec.deviceScale
    : Math.min(W * (opts.widthFactor ?? 0.78), (visible / 0.87) * asp) * spec.deviceScale;
  placeDevice(env, { cx: opts.cx ?? W / 2, top, width, rot: opts.rot ?? spec.tilt, src });
}

function layoutBottom(env: Env) {
  const { W, H, pad, unit, spec } = env;
  const maxW = W - pad * 2;
  const tb = measureBlock(env, maxW);
  const ty = H - H * 0.06 - tb.height;
  const src = resolveScreen(spec, env.o.family);
  const asp = aspectFor(env, env.device, src);
  const bottom = ty - unit * 0.075 + spec.deviceOffset * H;
  const width = Math.min(W * 0.78, (Math.max(bottom, H * 0.3) / 0.87) * asp) * spec.deviceScale;
  const g = deviceGeometry(env.device, width, env.device === "none" ? framelessAspect(env, src) : undefined);
  placeDevice(env, { cx: W / 2, top: bottom - g.h, width, rot: spec.tilt, src });
  drawBlock(env, tb, pad, ty, maxW, spec.textAlign);
}

function layoutTilted(env: Env) {
  const { W, H, pad, unit, spec } = env;
  const maxW = W - pad * 2;
  const tb = measureBlock(env, maxW);
  const ty = H * 0.062;
  const src = resolveScreen(spec, env.o.family);
  const top = ty + tb.height + unit * 0.11 + spec.deviceOffset * H;
  const width = W * 0.74 * spec.deviceScale;
  placeDevice(env, { cx: W * 0.56, top, width, rot: spec.tilt || 12, src });
  drawBlock(env, tb, pad, ty, maxW, spec.textAlign);
}

function layoutDuo(env: Env) {
  const { W, H, pad, unit, spec } = env;
  const maxW = W - pad * 2;
  const tb = measureBlock(env, maxW);
  const ty = H * 0.062;
  drawBlock(env, tb, pad, ty, maxW, spec.textAlign);
  const src = resolveScreen(spec, env.o.family);
  const src2 = resolveScreen(spec, env.o.family, "secondary");
  const asp = aspectFor(env, env.device, src);
  const top = ty + tb.height + unit * 0.075 + spec.deviceOffset * H;
  const width = Math.min(W * 0.56, ((H - top) / 0.84) * asp) * spec.deviceScale;
  placeDevice(env, { cx: W * 0.33, top, width: width * 0.94, rot: -7 + spec.tilt, src: src2 });
  placeDevice(env, { cx: W * 0.67, top: top + H * 0.05, width, rot: 6 + spec.tilt, src });
}

function layoutBigType(env: Env) {
  const { W, H, pad, unit, spec } = env;
  const maxW = W - pad * 2;
  const tb = measureBlock(env, maxW, 1.45);
  const ty = H * 0.06;
  drawBlock(env, tb, pad, ty, maxW, "left");
  const src = resolveScreen(spec, env.o.family);
  const asp = aspectFor(env, env.device, src);
  const top = ty + tb.height + unit * 0.085 + spec.deviceOffset * H;
  const width = Math.min(W * 0.7, ((H - top) / 0.8) * asp) * spec.deviceScale;
  placeDevice(env, { cx: W * 0.62, top, width, rot: spec.tilt, src });
}

function layoutSpotlight(env: Env) {
  const { ctx, W, H, pad, unit, spec } = env;
  const maxW = W - pad * 2;
  const tb = measureBlock(env, maxW, 0.95);
  const src = resolveScreen(spec, env.o.family);
  const asp = aspectFor(env, env.device, src);
  const availH = H * 0.88 - tb.height - unit * 0.08;
  const width = Math.min(W * 0.7, availH * asp) * spec.deviceScale;
  const g = deviceGeometry(env.device, width, env.device === "none" ? framelessAspect(env, src) : undefined);
  const top = H * 0.055 + spec.deviceOffset * H;
  const gx = W / 2;
  const gy = top + g.h * 0.45;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, W * 0.78);
  glow.addColorStop(0, rgba(spec.accentColor, 0.55));
  glow.addColorStop(0.5, rgba(spec.accentColor, 0.16));
  glow.addColorStop(1, rgba(spec.accentColor, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  placeDevice(env, { cx: W / 2, top, width, rot: spec.tilt, src });
  drawBlock(env, tb, pad, top + g.h + unit * 0.08, maxW, spec.textAlign);
}

function layoutPanorama(env: Env) {
  const idx = env.o.panorama?.index ?? 0;
  const even = idx % 2 === 0;
  layoutTop(env, { rot: (even ? -7 : 7) + env.spec.tilt, cx: env.W * (even ? 0.54 : 0.46), widthFactor: 0.76 });
}

function layoutFullBleed(env: Env) {
  const { ctx, W, H, pad, spec } = env;
  const src = resolveScreen(spec, env.o.family);
  drawScreenContent(env, src, "none", 0, 0, W, H);
  const maxW = W - pad * 2;
  const tb = measureBlock(env, maxW);
  const scrimH = H * 0.06 + tb.height + H * 0.12;
  const c0 = spec.background.colors[0] ?? "#000000";
  const g = ctx.createLinearGradient(0, 0, 0, scrimH);
  g.addColorStop(0, rgba(c0, 0.97));
  g.addColorStop(0.62, rgba(c0, 0.88));
  g.addColorStop(1, rgba(c0, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, scrimH);
  drawBlock(env, tb, pad, H * 0.06, maxW, spec.textAlign);
}

function layoutLandscape(env: Env) {
  const { W, H, spec } = env;
  const maxW = W * 0.44;
  const tb = measureBlock(env, maxW);
  const src = resolveScreen(spec, env.o.family);
  const asp = aspectFor(env, env.device, src);
  if (spec.layout === "duo") {
    const width = Math.min(W * 0.24, H * 0.95 * asp) * spec.deviceScale;
    placeDevice(env, { cx: W * 0.66, top: H * 0.1, width: width * 0.94, rot: -7 + spec.tilt, src: resolveScreen(spec, env.o.family, "secondary") });
    placeDevice(env, { cx: W * 0.82, top: H * 0.16, width, rot: 6 + spec.tilt, src });
  } else {
    const width = Math.min(W * 0.34, H * 1.02 * asp) * spec.deviceScale;
    const rot = spec.layout === "tilted" ? spec.tilt || 10 : spec.tilt;
    placeDevice(env, { cx: W * 0.75, top: H * 0.12 + spec.deviceOffset * H, width, rot, src });
  }
  drawBlock(env, tb, W * 0.065, (H - tb.height) / 2, maxW, "left");
}

export function renderScreenshot(ctx: Ctx, spec: ScreenshotSpec, o: RenderOptions) {
  const W = o.width;
  const H = o.height;
  const anim = o.anim ?? STATIC_ANIM;
  const landscape = W > H * 1.1;
  const device: ResolvedDevice = spec.layout === "frameless" ? "none" : resolveDevice(spec, o.family);
  const env: Env = {
    ctx,
    spec,
    o,
    W,
    H,
    unit: landscape ? H * 1.25 : Math.min(W, H * 0.5),
    pad: landscape ? W * 0.06 : W * 0.075,
    fd: FONTS[spec.font] ?? FONTS.inter,
    anim,
    px: o.pxScale ?? 1,
    device,
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (anim.zoom !== 1) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(anim.zoom, anim.zoom);
    ctx.translate(-W / 2, -H / 2);
  }
  drawBackground(ctx, spec.background, W, H, spec.layout === "panorama" ? o.panorama : undefined);
  if (spec.layout === "full-bleed" && !landscape) layoutFullBleed(env);
  else if (landscape) layoutLandscape(env);
  else {
    switch (spec.layout) {
      case "headline-bottom":
        layoutBottom(env);
        break;
      case "tilted":
        layoutTilted(env);
        break;
      case "duo":
        layoutDuo(env);
        break;
      case "frameless":
        layoutTop(env, { frameless: true });
        break;
      case "big-type":
        layoutBigType(env);
        break;
      case "spotlight":
        layoutSpotlight(env);
        break;
      case "panorama":
        layoutPanorama(env);
        break;
      default:
        layoutTop(env);
    }
  }
  ctx.restore();
}

// ---------------- App icon & outro ----------------
export function drawAppIcon(ctx: Ctx, x: number, y: number, s: number, c1: string, c2: string, name: string, px = 1) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = s * 0.18 * px;
  ctx.shadowOffsetY = s * 0.06 * px;
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  fillRR(ctx, x, y, s, s, s * 0.225, g);
  ctx.restore();
  ctx.save();
  rr(ctx, x, y, s, s, s * 0.225);
  ctx.clip();
  const hl = ctx.createLinearGradient(x, y, x, y + s);
  hl.addColorStop(0, "rgba(255,255,255,0.28)");
  hl.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  ctx.fillRect(x, y, s, s);
  ctx.restore();
  ctx.font = fontStr(800, s * 0.52, "SS Inter");
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.fillText((name.trim()[0] ?? "A").toUpperCase(), x + s / 2, y + s * 0.69);
  ctx.textAlign = "left";
}

export interface VideoOutro {
  title: string;
  subtitle: string;
  duration: number;
  badge: "app-store" | "google-play" | "none";
  background: Background;
  textColor: string;
  font: FontKey;
  brandColor: string;
  brandColor2: string;
}

function drawOutro(ctx: Ctx, outro: VideoOutro, lt: number, o: RenderOptions) {
  const W = o.width;
  const H = o.height;
  const px = o.pxScale ?? 1;
  drawBackground(ctx, outro.background, W, H);
  const unit = Math.min(W, H * 0.5);
  const fd = FONTS[outro.font] ?? FONTS.inter;
  const e = easeOutBack(lt / 0.7);
  const a = clamp(lt / 0.45);
  const s = unit * 0.3;
  const iy = H * 0.34 - s / 2;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(W / 2, iy + s / 2);
  const sc = 0.6 + 0.4 * e;
  ctx.scale(sc, sc);
  drawAppIcon(ctx, -s / 2, -s / 2, s, outro.brandColor, outro.brandColor2, outro.title, px);
  ctx.restore();
  const ta = easeOutCubic((lt - 0.25) / 0.6);
  ctx.save();
  ctx.globalAlpha *= ta;
  ctx.translate(0, (1 - ta) * unit * 0.05);
  ctx.textAlign = "center";
  ctx.fillStyle = outro.textColor;
  ctx.font = fontStr(fd.headlineWeight, unit * 0.1, fd.family);
  ctx.fillText(outro.title, W / 2, iy + s + unit * 0.17);
  ctx.font = fontStr(fd.bodyWeight, unit * 0.042, fd.bodyFamily);
  ctx.fillStyle = rgba(outro.textColor, 0.78);
  wrapPlain(ctx, outro.subtitle, W * 0.8).forEach((l, i) => ctx.fillText(l, W / 2, iy + s + unit * 0.26 + i * unit * 0.058));
  ctx.restore();
  if (outro.badge !== "none") {
    const ba = easeOutCubic((lt - 0.55) / 0.5);
    const bw = unit * 0.56;
    const bh = unit * 0.15;
    const bx = W / 2 - bw / 2;
    const by = H * 0.72;
    ctx.save();
    ctx.globalAlpha *= ba;
    fillRR(ctx, bx, by, bw, bh, bh * 0.26, "#000000");
    strokeRR(ctx, bx, by, bw, bh, bh * 0.26, "rgba(255,255,255,0.55)", Math.max(1, unit * 0.003));
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    const small = outro.badge === "app-store" ? "Download on the" : "GET IT ON";
    const big = outro.badge === "app-store" ? "App Store" : "Google Play";
    ctx.font = fontStr(500, bh * 0.2, "SS Inter");
    ctx.fillText(small, W / 2, by + bh * 0.38);
    ctx.font = fontStr(700, bh * 0.36, "SS Inter");
    ctx.fillText(big, W / 2, by + bh * 0.78);
    ctx.restore();
  }
  ctx.textAlign = "left";
}

// ---------------- Video ----------------
export interface VideoSceneInput {
  spec: ScreenshotSpec;
  duration: number;
  transition: TransitionKind;
  motion: MotionKind;
  panorama?: { index: number; count: number };
}
export interface VideoInput {
  scenes: VideoSceneInput[];
  outro: VideoOutro | null;
  transitionDuration: number;
}
interface Segment {
  start: number;
  duration: number;
  kind: "scene" | "outro";
  index: number;
}

export function videoTimeline(input: VideoInput): { segments: Segment[]; total: number } {
  const segments: Segment[] = [];
  let t = 0;
  input.scenes.forEach((s, i) => {
    segments.push({ start: t, duration: s.duration, kind: "scene", index: i });
    t += s.duration;
  });
  if (input.outro) {
    segments.push({ start: t, duration: input.outro.duration, kind: "outro", index: -1 });
    t += input.outro.duration;
  }
  return { segments, total: t };
}

function sceneAnim(motion: MotionKind, lt: number, d: number): SceneAnim {
  const p = clamp(lt / d);
  return {
    text: easeOutCubic((lt - 0.15) / 0.6),
    device: motion === "rise" ? easeOutCubic(lt / 0.9) : 1,
    zoom: motion === "zoom-in" ? 1 + 0.08 * easeInOutCubic(p) : 1,
    panX: motion === "pan" ? (0.5 - easeInOutCubic(p)) * 0.08 : 0,
    floatY: motion === "float" ? Math.sin(lt * 2.2) * 0.01 : 0,
    mock: easeOutCubic((lt - 0.3) / Math.max(0.5, d * 0.7)),
    scroll: motion === "scroll" ? easeInOutCubic((lt - 0.4) / Math.max(0.5, d - 0.8)) : 0,
  };
}

export function renderVideoFrame(ctx: Ctx, input: VideoInput, t: number, o: RenderOptions) {
  const W = o.width;
  const H = o.height;
  const { segments } = videoTimeline(input);
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (!segments.length) {
    ctx.restore();
    return;
  }
  let i = segments.findIndex((s) => t < s.start + s.duration);
  if (i < 0) i = segments.length - 1;
  const seg = segments[i];
  const lt = t - seg.start;
  const drawSeg = (s: Segment, localT: number) => {
    if (s.kind === "outro" && input.outro) drawOutro(ctx, input.outro, localT, { ...o });
    else {
      const sc = input.scenes[s.index];
      renderScreenshot(ctx, sc.spec, { ...o, panorama: sc.panorama, anim: sceneAnim(sc.motion, localT, sc.duration), time: localT });
    }
  };
  const transition: TransitionKind = seg.kind === "outro" ? "fade" : input.scenes[seg.index].transition;
  const T = input.transitionDuration;
  if (i > 0 && lt < T && transition !== "none") {
    const prev = segments[i - 1];
    const k = easeInOutCubic(lt / T);
    const prevT = prev.duration + lt;
    if (transition === "fade") {
      drawSeg(prev, prevT);
      ctx.save();
      ctx.globalAlpha = k;
      drawSeg(seg, lt);
      ctx.restore();
    } else if (transition === "slide" || transition === "push") {
      const horiz = transition === "slide";
      ctx.save();
      ctx.translate(horiz ? -k * W : 0, horiz ? 0 : -k * H);
      drawSeg(prev, prevT);
      ctx.restore();
      ctx.save();
      ctx.translate(horiz ? (1 - k) * W : 0, horiz ? 0 : (1 - k) * H);
      drawSeg(seg, lt);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(1 + 0.18 * k, 1 + 0.18 * k);
      ctx.translate(-W / 2, -H / 2);
      drawSeg(prev, prevT);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(W / 2, H / 2);
      const s = 0.9 + 0.1 * k;
      ctx.scale(s, s);
      ctx.translate(-W / 2, -H / 2);
      drawSeg(seg, lt);
      ctx.restore();
    }
  } else drawSeg(seg, lt);
  ctx.restore();
}

export function buildOutro(
  project: { name: string; tagline: string; primaryColor: string; accentColor: string; font: string },
  settings: { outro: { enabled: boolean; title: string; subtitle: string; duration: number; badge: "app-store" | "google-play" | "none" } },
  background: Background | undefined,
  textColor: string | undefined,
): VideoOutro | null {
  if (!settings.outro.enabled) return null;
  return {
    title: settings.outro.title || project.name,
    subtitle: settings.outro.subtitle || project.tagline,
    duration: settings.outro.duration,
    badge: settings.outro.badge,
    background: background ?? DEFAULT_SPEC.background,
    textColor: textColor ?? "#FFFFFF",
    font: (FONTS[project.font as FontKey] ? project.font : "inter") as FontKey,
    brandColor: lighten(project.primaryColor, 0.1),
    brandColor2: project.accentColor,
  };
}
