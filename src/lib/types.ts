// Shared, isomorphic types + normalizers (used by DB, API, renderer and UI).

export type Platform = "ios" | "android" | "both";
export type LayoutKind =
  | "headline-top"
  | "headline-bottom"
  | "tilted"
  | "duo"
  | "frameless"
  | "full-bleed"
  | "big-type"
  | "spotlight"
  | "panorama";
export type DeviceKind =
  | "auto"
  | "iphone"
  | "iphone-classic"
  | "ipad"
  | "pixel"
  | "galaxy"
  | "android-tablet"
  | "none";
export type ResolvedDevice = Exclude<DeviceKind, "auto">;
export type DeviceFamily = "iphone" | "iphone-classic" | "ipad" | "android" | "android-tablet";
export type MockKind =
  | "dashboard"
  | "terminal"
  | "code"
  | "pr"
  | "chat"
  | "analytics"
  | "issues"
  | "deploy"
  | "notifications"
  | "onboarding";
export type BackgroundType = "solid" | "linear" | "radial" | "mesh" | "grid" | "dots";
export type FontKey = "inter" | "space-grotesk" | "dm-serif" | "jetbrains-mono" | "poppins";
export type EyebrowStyle = "pill" | "stars" | "plain";
export type TextAlign = "left" | "center";

export type ScreenSource =
  | { kind: "mock"; mock: MockKind; dark: boolean }
  | { kind: "asset"; assetId: string };

export interface Background {
  type: BackgroundType;
  colors: string[];
  angle: number;
}

export interface StyleSpec {
  layout: LayoutKind;
  device: DeviceKind;
  frameColor: string;
  background: Background;
  textColor: string;
  accentColor: string;
  font: FontKey;
  textAlign: TextAlign;
  headlineScale: number;
  deviceScale: number;
  deviceOffset: number;
  tilt: number;
  eyebrowStyle: EyebrowStyle;
  shadow: boolean;
}

export interface ContentSpec {
  headline: string;
  subheadline: string;
  eyebrow: string;
  screen: ScreenSource;
  screen2: ScreenSource;
  overrides: { ipad?: ScreenSource; android?: ScreenSource };
  showStatusBar: boolean;
}

export type ScreenshotSpec = StyleSpec & ContentSpec;

export const LAYOUT_IDS: readonly LayoutKind[] = [
  "headline-top",
  "headline-bottom",
  "tilted",
  "duo",
  "frameless",
  "full-bleed",
  "big-type",
  "spotlight",
  "panorama",
];
export const DEVICE_IDS: readonly DeviceKind[] = [
  "auto",
  "iphone",
  "iphone-classic",
  "ipad",
  "pixel",
  "galaxy",
  "android-tablet",
  "none",
];
export const MOCK_IDS: readonly MockKind[] = [
  "dashboard",
  "terminal",
  "code",
  "pr",
  "chat",
  "analytics",
  "issues",
  "deploy",
  "notifications",
  "onboarding",
];
export const BG_IDS: readonly BackgroundType[] = ["solid", "linear", "radial", "mesh", "grid", "dots"];
export const FONT_IDS: readonly FontKey[] = ["inter", "space-grotesk", "dm-serif", "jetbrains-mono", "poppins"];

export const STYLE_KEYS: (keyof StyleSpec)[] = [
  "layout",
  "device",
  "frameColor",
  "background",
  "textColor",
  "accentColor",
  "font",
  "textAlign",
  "headlineScale",
  "deviceScale",
  "deviceOffset",
  "tilt",
  "eyebrowStyle",
  "shadow",
];

export const DEFAULT_SPEC: ScreenshotSpec = {
  layout: "headline-top",
  device: "auto",
  frameColor: "#1C1C1E",
  background: { type: "mesh", colors: ["#0B1026", "#6366F1", "#22D3EE", "#A855F7"], angle: 160 },
  textColor: "#FFFFFF",
  accentColor: "#67E8F9",
  font: "inter",
  textAlign: "center",
  headlineScale: 1,
  deviceScale: 1,
  deviceOffset: 0,
  tilt: 0,
  eyebrowStyle: "pill",
  shadow: true,
  headline: "Your app, *beautifully* framed",
  subheadline: "Store-ready screenshots in seconds.",
  eyebrow: "",
  screen: { kind: "mock", mock: "dashboard", dark: true },
  screen2: { kind: "mock", mock: "analytics", dark: true },
  overrides: {},
  showStatusBar: true,
};

type Dict = Record<string, unknown>;
const isObj = (v: unknown): v is Dict => !!v && typeof v === "object" && !Array.isArray(v);

function oneOf<T extends string>(v: unknown, list: readonly T[], fb: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fb;
}
function num(v: unknown, fb: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
}
function str(v: unknown, fb: string, max = 400): string {
  return typeof v === "string" ? v.slice(0, max) : fb;
}
function bool(v: unknown, fb: boolean): boolean {
  return typeof v === "boolean" ? v : fb;
}
export function normColor(v: unknown, fb: string): string {
  if (typeof v !== "string") return fb;
  let s = v.trim();
  if (!s.startsWith("#")) s = "#" + s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = "#" + s.slice(1).split("").map((c) => c + c).join("");
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : fb;
}

export function normScreen(v: unknown, fb: ScreenSource): ScreenSource {
  if (!isObj(v)) return fb;
  if ((v.kind === "asset" || v.kind === undefined) && typeof v.assetId === "string" && v.assetId) {
    return { kind: "asset", assetId: v.assetId };
  }
  if (v.kind === "mock" || typeof v.mock === "string") {
    return {
      kind: "mock",
      mock: oneOf(v.mock, MOCK_IDS, fb.kind === "mock" ? fb.mock : "dashboard"),
      dark: bool(v.dark, fb.kind === "mock" ? fb.dark : true),
    };
  }
  return fb;
}

export function normalizeSpec(input: unknown, base: ScreenshotSpec = DEFAULT_SPEC): ScreenshotSpec {
  const i: Dict = isObj(input) ? input : {};
  const bg: Dict = isObj(i.background) ? i.background : {};
  const colors = Array.isArray(bg.colors)
    ? bg.colors.map((c) => normColor(c, "")).filter(Boolean).slice(0, 4)
    : base.background.colors;
  const ovIn: Dict = isObj(i.overrides) ? i.overrides : (base.overrides as Dict);
  const overrides: ScreenshotSpec["overrides"] = {};
  if (isObj(ovIn.ipad)) overrides.ipad = normScreen(ovIn.ipad, base.screen);
  if (isObj(ovIn.android)) overrides.android = normScreen(ovIn.android, base.screen);
  return {
    layout: oneOf(i.layout, LAYOUT_IDS, base.layout),
    device: oneOf(i.device, DEVICE_IDS, base.device),
    frameColor: normColor(i.frameColor, base.frameColor),
    background: {
      type: oneOf(bg.type, BG_IDS, base.background.type),
      colors: colors.length ? colors : base.background.colors,
      angle: num(bg.angle, base.background.angle, 0, 360),
    },
    textColor: normColor(i.textColor, base.textColor),
    accentColor: normColor(i.accentColor, base.accentColor),
    font: oneOf(i.font, FONT_IDS, base.font),
    textAlign: oneOf(i.textAlign, ["left", "center"] as const, base.textAlign),
    headlineScale: num(i.headlineScale, base.headlineScale, 0.5, 1.8),
    deviceScale: num(i.deviceScale, base.deviceScale, 0.5, 1.4),
    deviceOffset: num(i.deviceOffset, base.deviceOffset, -0.4, 0.4),
    tilt: num(i.tilt, base.tilt, -30, 30),
    eyebrowStyle: oneOf(i.eyebrowStyle, ["pill", "stars", "plain"] as const, base.eyebrowStyle),
    shadow: bool(i.shadow, base.shadow),
    headline: str(i.headline, base.headline, 200),
    subheadline: str(i.subheadline, base.subheadline, 300),
    eyebrow: str(i.eyebrow, base.eyebrow, 60),
    screen: normScreen(i.screen, base.screen),
    screen2: normScreen(i.screen2, base.screen2),
    overrides,
    showStatusBar: bool(i.showStatusBar, base.showStatusBar),
  };
}

export function pickStyle(spec: ScreenshotSpec | StyleSpec): StyleSpec {
  return normalizeStyle(spec);
}

export function normalizeStyle(input: unknown, base?: StyleSpec): StyleSpec {
  const full = normalizeSpec(input, base ? { ...DEFAULT_SPEC, ...base } : DEFAULT_SPEC);
  const out = {} as Dict;
  for (const k of STYLE_KEYS) out[k] = full[k];
  return out as unknown as StyleSpec;
}

export function collectAssetIds(spec: ScreenshotSpec): string[] {
  const ids = new Set<string>();
  for (const s of [spec.screen, spec.screen2, spec.overrides.ipad, spec.overrides.android]) {
    if (s && s.kind === "asset") ids.add(s.assetId);
  }
  return [...ids];
}

// ---------------- Video ----------------
export type TransitionKind = "fade" | "slide" | "push" | "zoom" | "none";
export type MotionKind = "rise" | "zoom-in" | "scroll" | "float" | "pan" | "none";
export const TRANSITION_IDS: readonly TransitionKind[] = ["fade", "slide", "push", "zoom", "none"];
export const MOTION_IDS: readonly MotionKind[] = ["rise", "zoom-in", "scroll", "float", "pan", "none"];

export interface VideoScene {
  id: string;
  screenshotId: string;
  duration: number;
  transition: TransitionKind;
  motion: MotionKind;
}

export interface VideoSettings {
  transitionDuration: number;
  outro: { enabled: boolean; title: string; subtitle: string; duration: number; badge: "app-store" | "google-play" | "none" };
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  transitionDuration: 0.6,
  outro: { enabled: true, title: "", subtitle: "", duration: 3, badge: "app-store" },
};

export function randomId(len = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function normalizeScenes(input: unknown): VideoScene[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(isObj)
    .filter((s) => typeof s.screenshotId === "string" && s.screenshotId)
    .slice(0, 30)
    .map((s) => ({
      id: typeof s.id === "string" && s.id ? s.id.slice(0, 40) : randomId(),
      screenshotId: String(s.screenshotId),
      duration: num(s.duration, 4, 1, 15),
      transition: oneOf(s.transition, TRANSITION_IDS, "fade"),
      motion: oneOf(s.motion, MOTION_IDS, "rise"),
    }));
}

export function normalizeVideoSettings(input: unknown, base: VideoSettings = DEFAULT_VIDEO_SETTINGS): VideoSettings {
  const i: Dict = isObj(input) ? input : {};
  const o: Dict = isObj(i.outro) ? i.outro : {};
  return {
    transitionDuration: num(i.transitionDuration, base.transitionDuration, 0.2, 1.5),
    outro: {
      enabled: bool(o.enabled, base.outro.enabled),
      title: str(o.title, base.outro.title, 60),
      subtitle: str(o.subtitle, base.outro.subtitle, 120),
      duration: num(o.duration, base.outro.duration, 1.5, 6),
      badge: oneOf(o.badge, ["app-store", "google-play", "none"] as const, base.outro.badge),
    },
  };
}

// ---------------- DTOs ----------------
export interface ProjectDTO {
  id: string;
  name: string;
  tagline: string;
  description: string;
  platforms: Platform;
  bundleId: string;
  category: string;
  primaryColor: string;
  accentColor: string;
  font: FontKey;
  createdAt: string;
  updatedAt: string;
  screenshotCount?: number;
  videoCount?: number;
  previewSpecs?: ScreenshotSpec[];
}

export interface ScreenshotDTO {
  id: string;
  projectId: string;
  position: number;
  name: string;
  spec: ScreenshotSpec;
  createdAt: string;
  updatedAt: string;
}

export interface VideoDTO {
  id: string;
  projectId: string;
  name: string;
  size: string;
  fps: number;
  scenes: VideoScene[];
  settings: VideoSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDTO {
  id: string;
  name: string;
  description: string;
  category: string;
  isBuiltin: boolean;
  spec: StyleSpec;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDTO {
  id: string;
  projectId: string | null;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
}

export interface ExportDTO {
  id: string;
  projectId: string | null;
  projectName: string | null;
  kind: "image" | "video" | "archive";
  name: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  sizeBytes: number;
  source: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface ApiKeyDTO {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}
