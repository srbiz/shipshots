import type { MockKind } from "../types";
import { circle, clamp, Ctx, darken, easeOutCubic, fillRR, fontStr, lighten, rgba, rr, strokeRR, wrapPlain } from "./canvas-utils";

export interface MockOptions {
  dark: boolean;
  accent: string;
  platform: "ios" | "android";
  tablet: boolean;
  classic: boolean;
  statusBar: boolean;
  progress: number; // 0..1 animation progress (1 = fully drawn)
  appName: string;
  time: number;
}

const UI = "SS Inter";
const MONO = "SS JetBrains Mono";

interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  dim: string;
  faint: string;
  accent: string;
  green: string;
  red: string;
  amber: string;
  blue: string;
  purple: string;
}

function makeTheme(dark: boolean, accent: string): Theme {
  return dark
    ? { dark, bg: "#0B0D12", surface: "#151922", surface2: "#1E2430", border: "#272E3C", text: "#F4F6FB", dim: "#8E97AB", faint: "#5E6779", accent, green: "#34D399", red: "#F87171", amber: "#FBBF24", blue: "#60A5FA", purple: "#C084FC" }
    : { dark, bg: "#F4F5F9", surface: "#FFFFFF", surface2: "#ECEEF3", border: "#E1E4EC", text: "#0F172A", dim: "#64748B", faint: "#94A3B8", accent, green: "#16A34A", red: "#DC2626", amber: "#D97706", blue: "#2563EB", purple: "#9333EA" };
}

class Painter {
  constructor(public ctx: Ctx, public th: Theme) {}
  text(s: string, x: number, y: number, size: number, weight = 500, color: string = this.th.text, align: CanvasTextAlign = "left", family = UI) {
    const c = this.ctx;
    c.font = fontStr(weight, size, family);
    c.textAlign = align;
    c.textBaseline = "alphabetic";
    c.fillStyle = color;
    c.fillText(s, x, y);
    c.textAlign = "left";
  }
  measure(s: string, size: number, weight = 500, family = UI): number {
    this.ctx.font = fontStr(weight, size, family);
    return this.ctx.measureText(s).width;
  }
  ellipsize(s: string, maxW: number, size: number, weight = 500, family = UI): string {
    if (this.measure(s, size, weight, family) <= maxW) return s;
    let t = s;
    while (t.length > 1 && this.measure(t + "…", size, weight, family) > maxW) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }
  wrap(s: string, maxW: number, size: number, weight = 500, family = UI): string[] {
    this.ctx.font = fontStr(weight, size, family);
    return wrapPlain(this.ctx, s, maxW);
  }
  box(x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) {
    fillRR(this.ctx, x, y, w, h, r, fill);
  }
  stroke(x: number, y: number, w: number, h: number, r: number, color: string, lw = 1) {
    strokeRR(this.ctx, x, y, w, h, r, color, lw);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, lw = 1) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.stroke();
  }
  circle(x: number, y: number, r: number, fill: string | CanvasGradient) {
    circle(this.ctx, x, y, r, fill);
  }
  ring(x: number, y: number, r: number, color: string, lw = 2) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.stroke();
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, color: string, lw = 2) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = "round";
    c.stroke();
    c.lineCap = "butt";
  }
  poly(points: [number, number][], color: string, lw = 2, fill = false) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    if (fill) {
      c.closePath();
      c.fillStyle = color;
      c.fill();
      return;
    }
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.stroke();
    c.lineCap = "butt";
  }
  check(x: number, y: number, s: number, color: string, lw = 2) {
    this.poly([[x - s * 0.5, y], [x - s * 0.12, y + s * 0.38], [x + s * 0.5, y - s * 0.36]], color, lw);
  }
  cross(x: number, y: number, s: number, color: string, lw = 2) {
    this.poly([[x - s / 2, y - s / 2], [x + s / 2, y + s / 2]], color, lw);
    this.poly([[x + s / 2, y - s / 2], [x - s / 2, y + s / 2]], color, lw);
  }
  chevron(x: number, y: number, s: number, color: string, dir: "right" | "left" | "down" = "right") {
    if (dir === "right") this.poly([[x - s / 2, y - s], [x + s / 2, y], [x - s / 2, y + s]], color, 2);
    else if (dir === "left") this.poly([[x + s / 2, y - s], [x - s / 2, y], [x + s / 2, y + s]], color, 2.2);
    else this.poly([[x - s, y - s / 2], [x, y + s / 2], [x + s, y - s / 2]], color, 1.8);
  }
  avatar(x: number, y: number, r: number, color: string, initials: string) {
    const g = this.ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, lighten(color, 0.15));
    g.addColorStop(1, darken(color, 0.25));
    this.circle(x, y, r, g);
    this.text(initials, x, y + r * 0.3, r * 0.78, 700, "#FFFFFF", "center");
  }
  pill(x: number, y: number, label: string, size: number, fg: string, bg: string, weight = 600): number {
    const w = this.measure(label, size, weight) + size * 1.6;
    const h = size * 1.9;
    this.box(x, y, w, h, h / 2, bg);
    this.text(label, x + size * 0.8, y + h / 2 + size * 0.36, size, weight, fg);
    return w;
  }
  appIcon(x: number, y: number, s: number, accent: string, letter: string) {
    const g = this.ctx.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, lighten(accent, 0.2));
    g.addColorStop(1, darken(accent, 0.25));
    this.box(x, y, s, s, s * 0.24, g);
    this.text(letter.slice(0, 1).toUpperCase(), x + s / 2, y + s * 0.68, s * 0.52, 800, "#FFFFFF", "center");
  }
  alpha(a: number, fn: () => void) {
    this.ctx.save();
    this.ctx.globalAlpha *= clamp(a);
    fn();
    this.ctx.restore();
  }
}

// ---------- Chrome ----------
function signal(p: Painter, x: number, y: number, color: string, s: number) {
  for (let i = 0; i < 4; i++) {
    const h = (4 + i * 2.2) * s;
    p.box(x + i * 4.6 * s, y + 11 * s - h, 3.2 * s, h, 1 * s, color);
  }
}
function wifi(p: Painter, x: number, y: number, color: string, s: number) {
  for (let i = 1; i <= 3; i++) {
    const c = p.ctx;
    c.beginPath();
    c.arc(x, y + 9 * s, i * 3.6 * s, -Math.PI * 0.76, -Math.PI * 0.24);
    c.strokeStyle = color;
    c.lineWidth = 2 * s;
    c.lineCap = "round";
    c.stroke();
    c.lineCap = "butt";
  }
}
function battery(p: Painter, x: number, y: number, color: string, s: number) {
  p.stroke(x, y, 25 * s, 12 * s, 3.8 * s, rgba(color, 0.45), 1.1 * s);
  p.box(x + 2.2 * s, y + 2.2 * s, 18 * s, 7.6 * s, 2.2 * s, color);
  p.box(x + 26.3 * s, y + 4 * s, 1.8 * s, 4 * s, 1 * s, rgba(color, 0.5));
}
function statusBar(p: Painter, W: number, o: MockOptions, color: string) {
  if (o.tablet) {
    p.text("9:41  Tue Jun 10", 22, 20, 12, 600, color);
    wifi(p, W - 62, 9, color, 0.85);
    battery(p, W - 46, 9, color, 0.85);
  } else if (o.platform === "ios" && o.classic) {
    p.text("9:41", W / 2, 15, 12, 600, color, "center");
    signal(p, 8, 4, color, 0.75);
    battery(p, W - 30, 5, color, 0.75);
  } else if (o.platform === "ios") {
    p.text("9:41", 58, 37, 17, 600, color, "center");
    signal(p, W - 100, 26, color, 1);
    wifi(p, W - 68, 25, color, 1);
    battery(p, W - 50, 26, color, 1);
  } else {
    p.text("12:30", 22, 27, 13.5, 500, color);
    wifi(p, W - 70, 15, color, 0.9);
    signal(p, W - 58, 15, color, 0.85);
    p.box(W - 30, 14, 8.5, 14, 2, color);
  }
}
function homeIndicator(p: Painter, W: number, H: number, o: MockOptions, color: string) {
  if (o.platform === "ios" && o.classic) return;
  if (o.platform === "ios" || o.tablet) p.box(W / 2 - 67, H - 13, 134, 5, 2.5, rgba(color, 0.85));
  else p.box(W / 2 - 54, H - 11, 108, 4, 2, rgba(color, 0.65));
}
function tabIcon(p: Painter, i: number, cx: number, cy: number, col: string) {
  const c = p.ctx;
  switch (i % 4) {
    case 0:
      p.stroke(cx - 9, cy - 8, 18, 16, 4, col, 2);
      p.line(cx - 9, cy - 2, cx + 9, cy - 2, col, 2);
      break;
    case 1:
      p.ring(cx, cy, 8.5, col, 2);
      p.poly([[cx - 3, cy + 1], [cx, cy - 3], [cx + 3, cy + 1]], col, 2);
      break;
    case 2:
      p.poly([[cx, cy - 9], [cx + 7, cy + 7], [cx, cy + 3], [cx - 7, cy + 7], [cx, cy - 9]], col, 2);
      break;
    default:
      p.ring(cx, cy, 4, col, 2);
      c.save();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        p.line(cx + Math.cos(a) * 6.5, cy + Math.sin(a) * 6.5, cx + Math.cos(a) * 9.5, cy + Math.sin(a) * 9.5, col, 2.4);
      }
      c.restore();
  }
}
function tabBar(p: Painter, W: number, H: number, bottom: number, items: string[], active: number) {
  const th = p.th;
  const h = 54 + bottom;
  const y = H - h;
  p.box(0, y, W, h, 0, rgba(th.dark ? "#0B0D12" : "#FFFFFF", 0.96));
  p.line(0, y + 0.5, W, y + 0.5, th.border);
  const cw = W / items.length;
  items.forEach((label, i) => {
    const cx = cw * i + cw / 2;
    const col = i === active ? th.accent : th.faint;
    tabIcon(p, i, cx, y + 20, col);
    p.text(label, cx, y + 45, 10.5, 600, col, "center");
  });
}
function sparkle(p: Painter, x: number, y: number, r: number, color: string) {
  const c = p.ctx;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.32;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
}
function statusIcon(p: Painter, x: number, y: number, status: string, t: number) {
  const th = p.th;
  const col = status === "pass" ? th.green : status === "fail" ? th.red : th.amber;
  p.circle(x, y, 13, rgba(col, 0.16));
  if (status === "pass") p.check(x, y, 10, col, 2.2);
  else if (status === "fail") p.cross(x, y, 7.5, col, 2.2);
  else {
    const a = t * 4;
    p.arc(x, y, 6, a, a + Math.PI * 1.4, col, 2.2);
  }
}

// ---------- Screens ----------
type MockFn = (p: Painter, W: number, H: number, top: number, bottom: number, o: MockOptions) => string | void;

const dashboard: MockFn = (p, W, H, top, bottom, o) => {
  const th = p.th;
  const pr = o.progress;
  let y = top + 4;
  p.text("Builds", 20, y + 34, 32, 800);
  p.avatar(W - 38, y + 22, 18, th.accent, "AC");
  y += 56;
  p.box(16, y, W - 32, 34, 10, th.surface2);
  const sw = (W - 36) / 3;
  p.box(18, y + 2, sw, 30, 8, th.surface);
  ["All", "Failing", "Running"].forEach((l, i) => p.text(l, 18 + sw * i + sw / 2, y + 22, 13, i === 0 ? 700 : 500, i === 0 ? th.text : th.dim, "center"));
  y += 48;
  const cw = (W - 48) / 3;
  const stats: [string, string, string][] = [["Passing", String(Math.round(128 * clamp(pr * 1.4))), th.green], ["Failing", "3", th.red], ["Queued", "7", th.amber]];
  stats.forEach(([l, v, c], i) => {
    const x = 16 + i * (cw + 8);
    p.box(x, y, cw, 76, 14, th.surface);
    p.circle(x + 16, y + 20, 4, c);
    p.text(l, x + 26, y + 24, 12, 600, th.dim);
    p.text(v, x + 14, y + 61, 26, 800);
  });
  y += 90;
  p.box(16, y, W - 32, 148, 16, th.surface);
  p.text("Build minutes", 30, y + 28, 15, 700);
  p.text("Last 7 days", W - 30, y + 28, 12, 500, th.dim, "right");
  const bars = [0.42, 0.66, 0.38, 0.82, 0.55, 0.95, 0.7];
  const bx0 = 30;
  const bw = (W - 60) / bars.length;
  const base = y + 118;
  bars.forEach((b, i) => {
    const hgt = Math.max(2, 70 * b * easeOutCubic(pr * 1.6 - i * 0.08));
    p.box(bx0 + i * bw + bw * 0.2, base - hgt, bw * 0.6, hgt, 5, i === 5 ? th.accent : rgba(th.accent, 0.35));
    p.text("MTWTFSS"[i], bx0 + i * bw + bw / 2, base + 18, 10, 600, th.faint, "center");
  });
  y += 162;
  p.text("Pipelines", 20, y + 18, 17, 700);
  p.text("See all", W - 20, y + 18, 13, 600, th.accent, "right");
  y += 30;
  const rows = [
    { name: "ios-release", num: "482", meta: "main · 4m 12s · 2m ago", s: "pass" },
    { name: "android-release", num: "311", meta: "main · running 6m", s: "run" },
    { name: "e2e-detox", num: "1208", meta: "feat/apple-pay · 11m 40s", s: "fail" },
    { name: "unit-tests", num: "2291", meta: "fix/login-crash · 1m 52s", s: "pass" },
    { name: "lint-typecheck", num: "2290", meta: "main · 48s · 1h ago", s: "pass" },
    { name: "nightly", num: "97", meta: "develop · 18m 22s · 6h ago", s: "pass" },
  ];
  for (let i = 0; i < rows.length && y + 62 < H - bottom - 56; i++) {
    const r = rows[i];
    p.alpha(clamp(pr * 4 - i * 0.4), () => {
      p.box(16, y, W - 32, 62, 14, th.surface);
      statusIcon(p, 40, y + 31, r.s, o.time);
      p.text(r.name, 62, y + 27, 14.5, 600);
      p.text(`#${r.num}`, 62 + p.measure(r.name, 14.5, 600) + 6, y + 27, 14.5, 500, th.faint);
      p.text(r.meta, 62, y + 46, 12, 500, th.dim);
      p.chevron(W - 34, y + 31, 5, th.faint);
    });
    y += 70;
  }
  tabBar(p, W, H, bottom, ["Builds", "Pull requests", "Releases", "Settings"], 0);
};

const terminal: MockFn = (p, W, H, top, bottom, o) => {
  const th = p.th;
  const T = o.dark
    ? { bg: "#0A0C10", fg: "#E6EDF3", dim: "#7D8590", green: "#3FB950", blue: "#58A6FF", red: "#F85149", yellow: "#D29922", key: "#1C2128" }
    : { bg: "#FBFAF7", fg: "#1F2328", dim: "#6E7781", green: "#1A7F37", blue: "#0969DA", red: "#CF222E", yellow: "#9A6700", key: "#E9ECEF" };
  p.box(0, 0, W, H, 0, T.bg);
  let y = top;
  p.chevron(20, y + 21, 6, th.accent, "left");
  p.text("Hosts", 30, y + 26, 16, 500, th.accent);
  const tw = p.measure("prod-api-01", 15, 700);
  p.circle(W / 2 - tw / 2 - 10, y + 21, 4, T.green);
  p.text("prod-api-01", W / 2 + 4, y + 26, 15, 700, T.fg, "center");
  p.text("+", W - 20, y + 29, 24, 400, th.accent, "right");
  y += 42;
  let tx = 14;
  ["prod-api-01", "staging", "db-replica"].forEach((t, i) => {
    const w = p.measure(t, 12, 500, MONO) + 22;
    p.box(tx, y, w, 26, 8, i === 0 ? rgba(T.fg, 0.1) : "rgba(0,0,0,0)");
    p.text(t, tx + 11, y + 17, 12, 500, i === 0 ? T.fg : T.dim, "left", MONO);
    tx += w + 6;
  });
  y += 44;
  const P: [string, string][] = [["deploy@prod-api-01", T.green], [":", T.fg], ["~/api", T.blue], ["$ ", T.fg]];
  const lines: [string, string][][] = [
    [["$ ", T.green], ["ssh deploy@prod-api-01", T.fg]],
    [["Welcome to Ubuntu 24.04.1 LTS", T.dim]],
    [["Last login: Tue Jun 10 09:12", T.dim]],
    [...P, ["git pull", T.fg]],
    [["Updating 3f2a1c4..9be7d10", T.fg]],
    [[" src/routes/payments.ts | 42 ", T.fg], ["+++++", T.green], ["---", T.red]],
    [[" src/lib/stripe.ts      | 17 ", T.fg], ["+++", T.green], ["-", T.red]],
    [[" 2 files changed, 47 insertions", T.dim]],
    [...P, ["npm run migrate", T.fg]],
    [["> api@2.4.0 migrate", T.dim]],
    [["[ok] ", T.green], ["add_apple_pay.sql", T.fg]],
    [["[ok] ", T.green], ["index_payments.sql", T.fg]],
    [...P, ["pm2 reload api", T.fg]],
    [["[PM2] ", T.blue], ["Applying action reload", T.fg]],
    [["[PM2] ", T.blue], ["[api](0) ", T.fg], ["online", T.green]],
    [["[PM2] ", T.blue], ["[api](1) ", T.fg], ["online", T.green]],
    [["warn ", T.yellow], ["memory at 71% on worker 1", T.fg]],
    [...P],
  ];
  const lh = 20;
  const maxLines = Math.floor((H - bottom - 60 - y) / lh);
  const shown = Math.max(1, Math.min(lines.length, Math.ceil(lines.length * clamp(o.progress))));
  const start = Math.max(0, shown - maxLines);
  let lx = 16;
  let ly = y;
  for (let i = start; i < shown; i++) {
    lx = 16;
    ly = y + (i - start) * lh;
    for (const [t, c] of lines[i]) {
      p.text(t, lx, ly + 14, 12, 400, c, "left", MONO);
      lx += p.measure(t, 12, 400, MONO);
    }
  }
  if (Math.floor(o.time * 2.2) % 2 === 0 || o.progress >= 1) p.box(lx + 1, ly + 3, 7, 14, 1, T.fg);
  const ky = H - bottom - 48;
  p.box(0, ky - 8, W, H - ky + 8, 0, rgba(T.bg, 0.95));
  const keys = ["esc", "tab", "ctrl", "alt", "|", "/", "~", "-"];
  const kw = (W - 16 - 7 * 5) / keys.length;
  keys.forEach((k, i) => {
    const kx = 8 + i * (kw + 5);
    p.box(kx, ky, kw, 36, 7, T.key);
    p.text(k, kx + kw / 2, ky + 23, 12, 500, T.fg, "center", MONO);
  });
};

const KW = new Set(["import", "from", "export", "const", "let", "async", "await", "if", "as", "return", "new", "type", "interface", "default", "else", "true", "false", "null", "struct", "var", "func", "guard", "try"]);
function highlight(line: string, C: Record<string, string>): [string, string][] {
  const out: [string, string][] = [];
  const re = /(\/\/.*$)|('[^']*'|"[^"]*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out.push([m[1], C.com]);
    else if (m[2]) out.push([m[2], C.str]);
    else if (m[3]) out.push([m[3], C.num]);
    else if (m[4]) {
      const next = line[re.lastIndex];
      const word = m[4];
      out.push([word, KW.has(word) ? C.kw : next === "(" ? C.fn : /^[A-Z]/.test(word) ? C.type : C.text]);
    } else out.push([m[0], C.text]);
  }
  return out;
}

const code: MockFn = (p, W, H, top, bottom, o) => {
  const th = p.th;
  const C = o.dark
    ? { bg: "#0D1117", gutter: "#6E7681", kw: "#FF7B72", str: "#A5D6FF", fn: "#D2A8FF", num: "#79C0FF", com: "#8B949E", type: "#FFA657", text: "#E6EDF3" }
    : { bg: "#FFFFFF", gutter: "#8C959F", kw: "#CF222E", str: "#0A3069", fn: "#8250DF", num: "#0550AE", com: "#6E7781", type: "#953800", text: "#1F2328" };
  p.box(0, 0, W, H, 0, C.bg);
  p.box(0, top, W, 42, 0, th.surface);
  p.text("payments.ts", 16, top + 26, 13, 600, th.text);
  const aw = p.measure("payments.ts", 13, 600);
  p.box(16, top + 39, aw, 3, 1.5, th.accent);
  p.text("stripe.ts", 16 + aw + 22, top + 26, 13, 500, th.dim);
  p.box(W - 78, top + 8, 62, 26, 13, th.accent);
  p.poly([[W - 64, top + 15], [W - 56, top + 21], [W - 64, top + 27]], "#FFFFFF", 0, true);
  p.text("Run", W - 50, top + 26, 13, 700, "#FFFFFF");
  const src = [
    "import { Router } from 'express';",
    "import { stripe } from '../lib/stripe';",
    "",
    "export const payments = Router();",
    "",
    "// Create an Apple Pay session",
    "payments.post('/pay', async (req, res) => {",
    "  const { amount, currency } = req.body;",
    "  const intent = await stripe.intents",
    "    .create({ amount, currency });",
    "  res.json({ secret: intent.secret });",
    "});",
    "",
    "// Webhook: mark the order as paid",
    "payments.post('/hook', verify, (req, res) => {",
    "  const event = req.body as Stripe.Event;",
    "  if (event.type === 'payment.succeeded') {",
    "    await markPaid(event.data.object.id);",
    "  }",
    "  res.sendStatus(200);",
    "});",
    "",
    "export default payments;",
  ];
  const y0 = top + 58;
  const lh = 21;
  const max = Math.floor((H - bottom - 40 - y0) / lh);
  const shown = Math.min(src.length, max, Math.max(1, Math.ceil(src.length * clamp(o.progress))));
  if (shown > 8) p.box(0, y0 + 8 * lh - 1, W, lh, 0, rgba(th.accent, 0.12));
  for (let i = 0; i < shown; i++) {
    const ly = y0 + i * lh + 14;
    p.text(String(i + 1), 28, ly, 11, 400, C.gutter, "right", MONO);
    let x = 42;
    for (const [t, c] of highlight(src[i], C)) {
      p.text(t, x, ly, 11.5, 400, c, "left", MONO);
      x += p.measure(t, 11.5, 400, MONO);
    }
  }
  const fy = H - bottom - 30;
  p.box(0, fy, W, H - fy, 0, th.surface);
  p.ring(22, fy + 15, 4, th.accent, 1.8);
  p.text("main", 32, fy + 19, 11.5, 600, th.text);
  p.text("TypeScript", 80, fy + 19, 11.5, 500, th.dim);
  p.text("Ln 9, Col 24", W - 16, fy + 19, 11.5, 500, th.dim, "right");
};

const pr: MockFn = (p, W, H, top, bottom) => {
  const th = p.th;
  let y = top;
  p.chevron(20, y + 21, 6, th.accent, "left");
  p.text("Pull requests", 30, y + 26, 16, 500, th.accent);
  y += 42;
  p.text("Add Apple Pay checkout", 20, y + 26, 22, 800);
  y += 38;
  const pw = p.pill(20, y, "Open", 12, "#FFFFFF", th.green);
  p.text(p.ellipsize("maya-k wants to merge 4 commits", W - pw - 50, 12.5), 20 + pw + 10, y + 16, 12.5, 500, th.dim);
  y += 38;
  let tx = 20;
  ["Conversation", "Files 6", "Checks 12/12"].forEach((t, i) => {
    p.text(t, tx, y + 16, 13.5, i === 1 ? 700 : 500, i === 1 ? th.text : th.dim);
    const tw = p.measure(t, 13.5, i === 1 ? 700 : 500);
    if (i === 1) p.box(tx, y + 27, tw, 3, 1.5, th.accent);
    tx += tw + 22;
  });
  p.line(0, y + 30.5, W, y + 30.5, th.border);
  y += 44;
  const diff: [string, string][] = [
    [" ", "struct CheckoutView: View {"],
    [" ", "  @State var total: Decimal"],
    ["-", "  Button(\"Pay\") { pay() }"],
    ["+", "  PayWithApplePayButton(.buy) {"],
    ["+", "    Task { await cart.pay() }"],
    ["+", "  }"],
    ["+", "  .frame(height: 48)"],
    [" ", "  .padding(.horizontal)"],
  ];
  const cardH = diff.length * 22 + 52;
  p.box(12, y, W - 24, cardH, 14, th.surface);
  p.stroke(12, y, W - 24, cardH, 14, th.border);
  p.text("CheckoutView.swift", 26, y + 27, 12.5, 700, th.text, "left", MONO);
  p.text("+48", W - 64, y + 27, 12, 700, th.green, "right", MONO);
  p.text("−12", W - 26, y + 27, 12, 700, th.red, "right", MONO);
  let dy = y + 42;
  diff.forEach(([k, t]) => {
    if (k !== " ") p.box(13, dy, W - 26, 22, 0, rgba(k === "+" ? th.green : th.red, 0.14));
    p.text(k, 22, dy + 15, 12, 700, k === "+" ? th.green : k === "-" ? th.red : th.faint, "left", MONO);
    p.text(t, 38, dy + 15, 11.5, 400, th.text, "left", MONO);
    dy += 22;
  });
  y += cardH + 14;
  const bw = W - 66 - 14;
  const lines = p.wrap("Nice! Can we memoize the merchant config so we skip the extra lookup?", bw - 26, 13, 500);
  const bh = 36 + lines.length * 18;
  p.avatar(32, y + 18, 14, th.purple, "JR");
  p.box(54, y, bw, bh, 14, th.surface2);
  p.text("jordan-r", 67, y + 21, 12.5, 700);
  p.text("2m", 54 + bw - 12, y + 21, 11.5, 500, th.faint, "right");
  lines.forEach((l, i) => p.text(l, 67, y + 41 + i * 18, 13, 500));
  const by = Math.max(y + bh + 16, H - bottom - 66);
  p.box(0, by, W, H - by, 0, th.surface);
  p.line(0, by + 0.5, W, by + 0.5, th.border);
  const half = (W - 44) / 2;
  p.box(16, by + 12, half, 42, 12, th.surface2);
  p.text("Request changes", 16 + half / 2, by + 38, 14, 600, th.text, "center");
  p.box(28 + half, by + 12, half, 42, 12, th.green);
  p.check(28 + half + half / 2 - 40, by + 33, 10, "#FFFFFF", 2.4);
  p.text("Approve", 28 + half + half / 2 + 8, by + 38, 14, 700, "#FFFFFF", "center");
};

const chat: MockFn = (p, W, H, top, bottom, o) => {
  const th = p.th;
  let y = top;
  p.circle(36, y + 24, 17, th.accent);
  sparkle(p, 36, y + 24, 9, "#FFFFFF");
  p.text("Agent", 62, y + 21, 16, 700);
  p.circle(66, y + 36, 3.5, th.green);
  p.text("online · watching 4 repos", 75, y + 40, 11.5, 500, th.dim);
  p.line(0, y + 52, W, y + 52, th.border);
  y += 66;
  const step = Math.max(1, Math.ceil(4 * clamp(o.progress * 1.05)));
  const userBubble = (text: string) => {
    const lines = p.wrap(text, W * 0.66, 14.5, 500);
    const bw = Math.max(...lines.map((l) => p.measure(l, 14.5, 500))) + 28;
    const bh = lines.length * 20 + 20;
    p.box(W - 16 - bw, y, bw, bh, 18, th.accent);
    lines.forEach((l, i) => p.text(l, W - 16 - bw + 14, y + 25 + i * 20, 14.5, 500, "#FFFFFF"));
    y += bh + 14;
  };
  userBubble("Why is the iOS release build failing?");
  if (step >= 2) {
    const maxW = W * 0.8;
    const lines = p.wrap("The Archive step fails because the App Store provisioning profile expired on Jun 3. I can renew it with fastlane match:", maxW - 28, 14, 500);
    const bh = lines.length * 20 + 20 + 46 + 48;
    p.box(16, y, maxW, bh, 18, th.surface);
    lines.forEach((l, i) => p.text(l, 30, y + 25 + i * 20, 14, 500));
    const cy = y + lines.length * 20 + 18;
    p.box(28, cy, maxW - 24, 36, 10, "#0B0F17");
    p.text("$ fastlane match appstore --force", 40, cy + 23, 11, 400, "#7EE787", "left", MONO);
    const ay = cy + 48;
    p.box(28, ay, 92, 32, 16, th.accent);
    p.text("Run fix", 74, ay + 21, 13, 700, "#FFFFFF", "center");
    p.box(128, ay, 100, 32, 16, th.surface2);
    p.text("View logs", 178, ay + 21, 13, 600, th.text, "center");
    y += bh + 14;
  }
  if (step >= 3) userBubble("Run it and retry the build");
  if (step >= 4) {
    const maxW = W * 0.8;
    p.box(16, y, maxW, 108, 18, th.surface);
    p.circle(38, y + 26, 10, rgba(th.green, 0.18));
    p.check(38, y + 26, 8, th.green, 2);
    p.text("Provisioning profile renewed", 56, y + 31, 13.5, 600);
    const a = o.time * 4;
    p.arc(38, y + 58, 6, a, a + Math.PI * 1.4, th.accent, 2.2);
    p.text("Build #483 running · 2m 10s", 56, y + 63, 13.5, 600);
    p.box(30, y + 82, maxW - 28, 6, 3, th.surface2);
    p.box(30, y + 82, (maxW - 28) * (0.64 * clamp(o.progress)), 6, 3, th.accent);
    y += 122;
  }
  const iy = H - bottom - 58;
  p.box(16, iy, W - 32, 46, 23, th.surface2);
  p.text("Message the agent…", 34, iy + 28, 14.5, 500, th.faint);
  p.circle(W - 40, iy + 23, 16, th.accent);
  p.poly([[W - 40, iy + 30], [W - 40, iy + 16]], "#FFFFFF", 2.4);
  p.poly([[W - 46, iy + 22], [W - 40, iy + 16], [W - 34, iy + 22]], "#FFFFFF", 2.4);
};

const analytics: MockFn = (p, W, H, top, bottom, o) => {
  const th = p.th;
  const c = p.ctx;
  let y = top + 4;
  p.text("Insights", 20, y + 32, 30, 800);
  const pw = p.measure("Last 30 days", 12.5, 600) + 36;
  p.box(W - 20 - pw, y + 12, pw, 28, 14, th.surface2);
  p.text("Last 30 days", W - 20 - pw + 12, y + 31, 12.5, 600);
  p.chevron(W - 33, y + 25, 4, th.dim, "down");
  y += 56;
  const kpis: [string, string, string][] = [["Crash-free users", "99.8%", "+0.4%"], ["Sessions", "48.2K", "+12%"], ["Cold start", "412ms", "−38ms"], ["App rating", "4.9", "+0.1"]];
  const cw = (W - 42) / 2;
  kpis.forEach(([l, v, d], i) => {
    const cx = 16 + (i % 2) * (cw + 10);
    const cy = y + Math.floor(i / 2) * 92;
    p.box(cx, cy, cw, 82, 16, th.surface);
    p.text(l, cx + 14, cy + 24, 12, 600, th.dim);
    p.text(v, cx + 14, cy + 58, 24, 800);
    const dw = p.measure(d, 11, 700) + 24;
    const dx = cx + cw - 12 - dw;
    p.box(dx, cy + 42, dw, 20, 10, rgba(th.green, 0.15));
    p.poly([[dx + 7, cy + 55], [dx + 10.5, cy + 49], [dx + 14, cy + 55]], th.green, 0, true);
    p.text(d, dx + 17, cy + 56, 11, 700, th.green);
  });
  y += 190;
  const chH = 172;
  p.box(16, y, W - 32, chH, 16, th.surface);
  p.text("Daily active users", 30, y + 26, 13, 600, th.dim);
  p.text("12,480", 30, y + 54, 24, 800);
  const pts = [0.3, 0.42, 0.36, 0.5, 0.46, 0.58, 0.53, 0.66, 0.6, 0.74, 0.8, 0.88];
  const x0 = 30;
  const x1 = W - 30;
  const yb = y + chH - 16;
  const yt = y + 72;
  for (let g = 0; g < 3; g++) p.line(x0, yt + ((yb - yt) * g) / 2, x1, yt + ((yb - yt) * g) / 2, rgba(th.faint, 0.18), 1);
  const P = pts.map((v, i) => [x0 + ((x1 - x0) * i) / (pts.length - 1), yb - (yb - yt) * v] as [number, number]);
  c.save();
  c.beginPath();
  c.rect(x0 - 4, yt - 12, (x1 - x0 + 8) * clamp(o.progress * 1.2), yb - yt + 16);
  c.clip();
  const path = () => {
    c.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) {
      const mx = (P[i][0] + P[i + 1][0]) / 2;
      const my = (P[i][1] + P[i + 1][1]) / 2;
      c.quadraticCurveTo(P[i][0], P[i][1], mx, my);
    }
    c.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
  };
  c.beginPath();
  path();
  c.lineTo(x1, yb);
  c.lineTo(x0, yb);
  c.closePath();
  const gr = c.createLinearGradient(0, yt, 0, yb);
  gr.addColorStop(0, rgba(th.accent, 0.35));
  gr.addColorStop(1, rgba(th.accent, 0));
  c.fillStyle = gr;
  c.fill();
  c.beginPath();
  path();
  c.strokeStyle = th.accent;
  c.lineWidth = 2.6;
  c.stroke();
  c.restore();
  y += chH + 12;
  const rows: [string, string, number, string][] = [["ImageCache.swift:212", "EXC_BAD_ACCESS", 0.42, th.red], ["SyncWorker.kt:88", "NullPointerException", 0.27, th.amber], ["MainActivity.onResume", "ANR · 5s", 0.12, th.amber]];
  p.box(16, y, W - 32, 40 + rows.length * 50, 16, th.surface);
  p.text("Top crashes", 30, y + 27, 14, 700);
  rows.forEach(([a, b, v, col], i) => {
    const ry = y + 44 + i * 50;
    p.text(a, 30, ry + 13, 13, 600);
    p.text(b, 30, ry + 30, 11.5, 500, th.dim);
    p.text(`${Math.round(v * 100)}%`, W - 30, ry + 13, 12.5, 700, th.text, "right");
    p.box(W - 130, ry + 23, 100, 6, 3, th.surface2);
    p.box(W - 130, ry + 23, 100 * v * 2 * clamp(o.progress * 1.3), 6, 3, col);
  });
  tabBar(p, W, H, bottom, ["Builds", "Insights", "Releases", "Settings"], 1);
};

const issues: MockFn = (p, W, H, top, bottom, o) => {
  const th = p.th;
  let y = top + 4;
  p.text("Issues", 20, y + 32, 30, 800);
  p.circle(W - 36, y + 22, 17, th.accent);
  p.line(W - 42, y + 22, W - 30, y + 22, "#FFFFFF", 2.4);
  p.line(W - 36, y + 16, W - 36, y + 28, "#FFFFFF", 2.4);
  y += 52;
  p.box(16, y, W - 32, 38, 12, th.surface2);
  p.ring(35, y + 18, 6, th.faint, 2);
  p.line(39.5, y + 22.5, 44, y + 27, th.faint, 2);
  p.text("Search 24 open issues", 54, y + 24, 14, 500, th.faint);
  y += 52;
  let cx = 16;
  ["Open 24", "Assigned", "bug", "p1", "android"].forEach((t, i) => {
    const w = p.measure(t, 12.5, 600) + 24;
    if (cx + w > W - 8) return;
    p.box(cx, y, w, 30, 15, i === 0 ? th.accent : th.surface);
    if (i !== 0) p.stroke(cx, y, w, 30, 15, th.border);
    p.text(t, cx + 12, y + 19.5, 12.5, 600, i === 0 ? "#FFFFFF" : th.text);
    cx += w + 8;
  });
  y += 46;
  const rows: { n: number; t: string; l: [string, string][]; m: string; c: number; av: [string, string] }[] = [
    { n: 912, t: "Crash on launch for iOS 17.2 devices", l: [["bug", th.red], ["p1", th.amber]], m: "#912 · opened 2h ago by sam", c: 8, av: ["SR", th.blue] },
    { n: 907, t: "Dark mode: diff colors unreadable", l: [["design", th.purple]], m: "#907 · opened 5h ago by lena", c: 3, av: ["LK", th.purple] },
    { n: 899, t: "Support GitLab merge request approvals", l: [["feature", th.blue]], m: "#899 · opened 1d ago by devon", c: 12, av: ["DM", th.green] },
    { n: 894, t: "Push notifications delayed on Pixel 8", l: [["bug", th.red], ["android", th.green]], m: "#894 · opened 2d ago by priya", c: 5, av: ["PS", th.amber] },
    { n: 881, t: "Biometric unlock for access tokens", l: [["security", th.amber], ["feature", th.blue]], m: "#881 · opened 3d ago by max", c: 2, av: ["MW", th.red] },
    { n: 876, t: "Offline cache for build logs", l: [["feature", th.blue]], m: "#876 · opened 4d ago by ana", c: 6, av: ["AR", th.blue] },
  ];
  const rh = 86;
  const count = Math.max(1, Math.min(rows.length, Math.floor((H - bottom - 60 - y) / rh)));
  p.box(16, y, W - 32, count * rh, 16, th.surface);
  for (let i = 0; i < count; i++) {
    const r = rows[i];
    const ry = y + i * rh;
    p.alpha(clamp(o.progress * 4 - i * 0.45), () => {
      p.ring(36, ry + 24, 7.5, th.green, 2);
      p.circle(36, ry + 24, 2.2, th.green);
      p.text(p.ellipsize(r.t, W - 32 - 92, 14, 600), 54, ry + 29, 14, 600);
      let lx = 54;
      r.l.forEach(([name, col]) => {
        lx += p.pill(lx, ry + 39, name, 10.5, col, rgba(col, 0.14), 700) + 6;
      });
      p.text(r.m, 54, ry + 74, 11.5, 500, th.dim);
      p.avatar(W - 44, ry + 24, 12, r.av[1], r.av[0]);
      p.stroke(W - 66, ry + 62, 14, 11, 3, th.faint, 1.4);
      p.text(String(r.c), W - 47, ry + 72, 11.5, 600, th.dim);
    });
    if (i < count - 1) p.line(54, ry + rh, W - 16, ry + rh, th.border);
  }
  tabBar(p, W, H, bottom, ["Inbox", "Issues", "Explore", "Profile"], 1);
};

const deploy: MockFn = (p, W, H, top, bottom, o) => {
  const th = p.th;
  let y = top + 4;
  p.text("Release 2.4.0", 20, y + 32, 28, 800);
  const pw = p.pill(20, y + 46, "Production", 11.5, th.accent, rgba(th.accent, 0.16), 700);
  p.text(p.ellipsize(`${o.appName} · build 482`, W - pw - 50, 12.5), 20 + pw + 8, y + 61, 12.5, 500, th.dim);
  y += 88;
  const cx = W / 2;
  const cy = y + 108;
  const R = 86;
  p.ring(cx, cy, R, th.surface2, 16);
  const pct = 0.72 * clamp(o.progress * 1.15);
  p.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, pct), th.accent, 16);
  p.text(`${Math.round(pct * 100)}%`, cx, cy + 12, 40, 800, th.text, "center");
  p.text("Uploading build", cx, cy + 36, 12.5, 500, th.dim, "center");
  y += 230;
  const steps: [string, string, string][] = [
    ["Build", "Compiled in 4m 12s", "done"],
    ["Test", "1,204 tests passed", "done"],
    ["Sign", "Distribution certificate", "done"],
    ["Upload", `App Store Connect · ${Math.round(pct * 100)}%`, "active"],
    ["Review", "Waiting for upload", "todo"],
  ];
  const sh = steps.length * 50 + 16;
  p.box(16, y, W - 32, sh, 16, th.surface);
  steps.forEach(([t, d, st], i) => {
    const sy = y + 10 + i * 50;
    const ix = 40;
    const iy = sy + 20;
    if (i < steps.length - 1) p.line(ix, iy + 13, ix, iy + 37, st === "done" ? th.green : th.border, 2);
    if (st === "done") {
      p.circle(ix, iy, 11, th.green);
      p.check(ix, iy, 9, "#FFFFFF", 2.2);
    } else if (st === "active") {
      p.circle(ix, iy, 11, rgba(th.accent, 0.18));
      const a = o.time * 4;
      p.arc(ix, iy, 6, a, a + Math.PI * 1.4, th.accent, 2.2);
    } else p.ring(ix, iy, 10, th.border, 2);
    p.text(t, 62, sy + 17, 14.5, 600, st === "todo" ? th.dim : th.text);
    p.text(d, 62, sy + 35, 12, 500, th.dim);
  });
  const by = Math.max(y + sh + 18, H - bottom - 94);
  p.box(16, by, W - 32, 52, 16, th.accent);
  p.text("Promote to 100%", W / 2, by + 32, 16, 700, "#FFFFFF", "center");
  p.text("Staged rollout · 10% of users", W / 2, by + 76, 12, 500, th.dim, "center");
};

const notifications: MockFn = (p, W, H, top, bottom, o) => {
  const c = p.ctx;
  const accent = o.accent;
  const g = c.createLinearGradient(0, 0, W * 0.5, H);
  g.addColorStop(0, o.dark ? darken(accent, 0.25) : lighten(accent, 0.1));
  g.addColorStop(1, o.dark ? "#06070B" : darken(accent, 0.45));
  p.box(0, 0, W, H, 0, g);
  const blob = (x: number, y: number, r: number, col: string, a: number) => {
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, rgba(col, a));
    rg.addColorStop(1, rgba(col, 0));
    c.fillStyle = rg;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(W * 0.85, H * 0.2, W * 0.75, lighten(accent, 0.35), 0.55);
  blob(W * 0.05, H * 0.75, W * 0.85, "#EC4899", 0.28);
  p.text("Tuesday, June 10", W / 2, top + 30, 18, 600, "rgba(255,255,255,0.86)", "center");
  p.text("9:41", W / 2, top + 118, 90, 700, "#FFFFFF", "center");
  let y = top + 196;
  const items: [string, string, string][] = [
    ["Build #482 passed", "ios-release on main · 4m 12s", "now"],
    ["PR #1287 approved", "jordan-r approved “Add Apple Pay checkout”", "3m ago"],
    ["Release 2.4.0 is live", "Rolled out to 10% of iOS users", "12m ago"],
    ["Nightly build failed", "e2e-detox · 3 tests failed on Pixel 8", "1h ago"],
  ];
  const max = Math.floor((H - bottom - 90 - y) / 86);
  items.slice(0, Math.max(1, max)).forEach(([t, b, ago], i) => {
    const e = easeOutCubic(o.progress * items.length * 0.9 - i);
    if (e <= 0) return;
    p.alpha(e, () => {
      const yy = y - (1 - e) * 24;
      p.box(10, yy, W - 20, 76, 22, "rgba(255,255,255,0.2)");
      p.stroke(10, yy, W - 20, 76, 22, "rgba(255,255,255,0.16)", 1);
      p.appIcon(22, yy + 15, 38, accent, o.appName);
      p.text(p.ellipsize(o.appName, W - 170, 13, 600), 70, yy + 28, 13, 600, "rgba(255,255,255,0.72)");
      p.text(ago, W - 24, yy + 28, 12, 500, "rgba(255,255,255,0.6)", "right");
      p.text(t, 70, yy + 47, 15, 700, "#FFFFFF");
      p.text(p.ellipsize(b, W - 100, 13.5, 500), 70, yy + 65, 13.5, 500, "rgba(255,255,255,0.88)");
    });
    y += 86;
  });
  const by = H - bottom - 42;
  p.circle(62, by, 25, "rgba(0,0,0,0.28)");
  p.box(58, by - 9, 8, 18, 3, "rgba(255,255,255,0.9)");
  p.circle(W - 62, by, 25, "rgba(0,0,0,0.28)");
  p.stroke(W - 73, by - 7, 22, 15, 4, "rgba(255,255,255,0.9)", 1.8);
  p.ring(W - 62, by + 0.5, 4, "rgba(255,255,255,0.9)", 1.8);
  return "#FFFFFF";
};

const onboarding: MockFn = (p, W, H, top, bottom, o) => {
  const th = p.th;
  const cy = top + 180;
  [150, 112, 74].forEach((r, i) => p.circle(W / 2, cy, r, rgba(th.accent, 0.07 + i * 0.06)));
  p.appIcon(W / 2 - 44, cy - 44, 88, th.accent, o.appName);
  const chip = (x: number, y: number, label: string, col: string, a: number) => {
    p.alpha(a, () => {
      const w = p.measure(label, 12.5, 600) + 44;
      p.box(x, y, w, 36, 18, th.surface);
      p.stroke(x, y, w, 36, 18, th.border);
      p.circle(x + 18, y + 18, 9, rgba(col, 0.2));
      p.check(x + 18, y + 18, 7, col, 1.8);
      p.text(label, x + 33, y + 22.5, 12.5, 600);
    });
  };
  chip(W / 2 - 160, cy - 118, "Build passed", th.green, clamp(o.progress * 3));
  chip(W / 2 + 34, cy - 66, "PR approved", th.purple, clamp(o.progress * 3 - 0.6));
  chip(W / 2 - 128, cy + 92, "v2.4.0 is live", th.accent, clamp(o.progress * 3 - 1.2));
  p.text("Your pipeline,", W / 2, cy + 200, 30, 800, th.text, "center");
  p.text("in your pocket", W / 2, cy + 238, 30, 800, th.accent, "center");
  p.wrap("Monitor builds, review code and ship releases from anywhere.", W - 80, 15, 500).forEach((l, i) =>
    p.text(l, W / 2, cy + 274 + i * 22, 15, 500, th.dim, "center"),
  );
  const dy = H - bottom - 150;
  p.box(W / 2 - 25, dy, 22, 8, 4, th.accent);
  p.circle(W / 2 + 9, dy + 4, 4, th.faint);
  p.circle(W / 2 + 23, dy + 4, 4, th.faint);
  const by = H - bottom - 120;
  p.box(20, by, W - 40, 54, 16, th.text);
  p.text("Continue with GitHub", W / 2, by + 33, 16, 700, th.bg, "center");
  p.text("Use GitLab instead", W / 2, by + 86, 14.5, 600, th.accent, "center");
};

const MOCK_FNS: Record<MockKind, MockFn> = { dashboard, terminal, code, pr, chat, analytics, issues, deploy, notifications, onboarding };

export function drawMock(ctx: Ctx, kind: MockKind, x: number, y: number, w: number, h: number, o: MockOptions) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const base = o.tablet ? 600 : 390;
  const s = w / base;
  ctx.scale(s, s);
  const W = base;
  const H = h / s;
  const th = makeTheme(o.dark, o.accent);
  const p = new Painter(ctx, th);
  const top = o.tablet ? 30 : o.platform === "ios" ? (o.classic ? 24 : 58) : 40;
  const bottom = o.tablet ? 16 : o.platform === "ios" ? (o.classic ? 0 : 34) : 18;
  p.box(0, 0, W, H, 0, th.bg);
  const statusColor = (MOCK_FNS[kind] ?? dashboard)(p, W, H, top, bottom, o) || th.text;
  if (o.statusBar) statusBar(p, W, o, statusColor);
  homeIndicator(p, W, H, o, statusColor);
  ctx.restore();
}

/** Simple placeholder used when an uploaded asset is missing or still loading. */
export function drawPlaceholder(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#1F2430");
  g.addColorStop(1, "#11141B");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const s = w * 0.22;
  const cx = x + w / 2;
  const cy = y + h / 2;
  strokeRR(ctx, cx - s / 2, cy - s * 0.4, s, s * 0.8, s * 0.12, "rgba(255,255,255,0.35)", Math.max(1, w * 0.008));
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.38, cy + s * 0.28);
  ctx.lineTo(cx - s * 0.1, cy - s * 0.02);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.16);
  ctx.lineTo(cx + s * 0.22, cy + s * 0.06);
  ctx.lineTo(cx + s * 0.38, cy + s * 0.28);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.stroke();
  circle(ctx, cx + s * 0.2, cy - s * 0.18, s * 0.07, "rgba(255,255,255,0.35)");
  rr(ctx, 0, 0, 0, 0, 0);
}
