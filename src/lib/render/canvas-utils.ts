// Isomorphic Canvas 2D helpers — work with browser canvases and @napi-rs/canvas.

export type Ctx = CanvasRenderingContext2D;
export interface Img {
  width: number;
  height: number;
}
export type ImageMap = Record<string, Img | null | undefined>;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutBack = (t: number) => {
  const x = clamp(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
export const hash = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}/.test(h)) return [0, 0, 0];
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a)})`;
}
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    "#" +
    A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}
export const lighten = (h: string, t: number) => mix(h, "#ffffff", t);
export const darken = (h: string, t: number) => mix(h, "#000000", t);
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const isDarkColor = (hex: string) => luminance(hex) < 0.35;

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
export function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}
export function strokeRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, stroke: string, lw: number) {
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}
export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
export function star(ctx: Ctx, cx: number, cy: number, r: number, fill: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
export function fontStr(weight: number, size: number, family: string): string {
  return `${weight} ${Math.max(1, size).toFixed(2)}px "${family}"`;
}

export function drawImageCover(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number, panY = 0, zoom = 1) {
  if (!img.width || !img.height) return;
  const ir = img.width / img.height;
  const r = w / h;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > r) {
    sh = img.height;
    sw = sh * r;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / r;
    sx = 0;
    sy = (img.height - sh) * clamp(panY);
  }
  if (zoom > 1) {
    const nsw = sw / zoom;
    const nsh = sh / zoom;
    sx += (sw - nsw) / 2;
    sy += (sh - nsh) / 2;
    sw = nsw;
    sh = nsh;
  }
  ctx.drawImage(img as unknown as CanvasImageSource, sx, sy, sw, sh, x, y, w, h);
}

// ---------- Rich text (*highlight* support, wrapping) ----------
export interface Seg {
  text: string;
  hl: boolean;
  w: number;
}
export interface Line {
  segs: Seg[];
  width: number;
}

type Item = { kind: "word"; parts: { t: string; hl: boolean }[] } | { kind: "space"; hl: boolean } | { kind: "br" };

function tokenize(text: string): Item[] {
  const items: Item[] = [];
  let hl = false;
  let buf = "";
  const flush = () => {
    if (!buf) return;
    const last = items[items.length - 1];
    if (last && last.kind === "word") last.parts.push({ t: buf, hl });
    else items.push({ kind: "word", parts: [{ t: buf, hl }] });
    buf = "";
  };
  for (const ch of text) {
    if (ch === "*") {
      flush();
      hl = !hl;
      continue;
    }
    if (ch === "\n") {
      flush();
      items.push({ kind: "br" });
      continue;
    }
    if (ch === " ") {
      flush();
      items.push({ kind: "space", hl });
      continue;
    }
    buf += ch;
  }
  flush();
  return items;
}

export function layoutRich(ctx: Ctx, text: string, maxWidth: number): Line[] {
  const items = tokenize(text);
  const spaceW = ctx.measureText(" ").width;
  const lines: Line[] = [];
  let cur: Seg[] = [];
  let curW = 0;
  let pendingSpace = false;
  let pendingHl = false;
  const pushLine = () => {
    lines.push({ segs: cur, width: curW });
    cur = [];
    curW = 0;
    pendingSpace = false;
  };
  for (const it of items) {
    if (it.kind === "br") {
      pushLine();
      continue;
    }
    if (it.kind === "space") {
      if (cur.length) {
        pendingSpace = true;
        pendingHl = it.hl;
      }
      continue;
    }
    const segs = it.parts.map((p) => ({ text: p.t, hl: p.hl, w: ctx.measureText(p.t).width }));
    const wordW = segs.reduce((a, s) => a + s.w, 0);
    const addW = (pendingSpace ? spaceW : 0) + wordW;
    if (cur.length && curW + addW > maxWidth) pushLine();
    if (pendingSpace && cur.length) {
      cur.push({ text: " ", hl: pendingHl, w: spaceW });
      curW += spaceW;
    }
    pendingSpace = false;
    cur.push(...segs);
    curW += wordW;
  }
  if (cur.length || lines.length === 0) pushLine();
  return lines;
}

/** Draws lines; `top` is the top of the first line box. Caller must set ctx.font. */
export function drawRich(
  ctx: Ctx,
  lines: Line[],
  x: number,
  top: number,
  lh: number,
  fs: number,
  align: "left" | "center",
  maxWidth: number,
  color: string,
  hlColor: string,
) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  lines.forEach((ln, i) => {
    let lx = align === "center" ? x + (maxWidth - ln.width) / 2 : x;
    const by = top + i * lh + (lh + fs * 0.7) / 2;
    for (const s of ln.segs) {
      ctx.fillStyle = s.hl ? hlColor : color;
      ctx.fillText(s.text, lx, by);
      lx += s.w;
    }
  });
}

export function wrapPlain(ctx: Ctx, text: string, maxWidth: number): string[] {
  return layoutRich(ctx, text.replace(/\*/g, ""), maxWidth).map((l) => l.segs.map((s) => s.text).join(""));
}

export function drawSpaced(ctx: Ctx, text: string, x: number, y: number, spacing: number): number {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x - spacing;
}
export function measureSpaced(ctx: Ctx, text: string, spacing: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return Math.max(0, w - spacing);
}
