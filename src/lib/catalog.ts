import type {
  Background,
  DeviceFamily,
  DeviceKind,
  FontKey,
  LayoutKind,
  MockKind,
  MotionKind,
  Platform,
  ResolvedDevice,
  TransitionKind,
} from "./types";

export interface OutputSize {
  id: string;
  label: string;
  store: "app-store" | "google-play";
  family: DeviceFamily;
  width: number;
  height: number;
  note: string;
  required?: boolean;
}

export const OUTPUT_SIZES: OutputSize[] = [
  { id: "iphone-69", label: 'iPhone 6.9"', store: "app-store", family: "iphone", width: 1320, height: 2868, note: "iPhone 16 Pro Max · required", required: true },
  { id: "iphone-67", label: 'iPhone 6.7"', store: "app-store", family: "iphone", width: 1290, height: 2796, note: "iPhone 15 Pro Max / 14 Plus" },
  { id: "iphone-65", label: 'iPhone 6.5"', store: "app-store", family: "iphone", width: 1242, height: 2688, note: "iPhone 11 Pro Max / XS Max" },
  { id: "iphone-63", label: 'iPhone 6.3"', store: "app-store", family: "iphone", width: 1206, height: 2622, note: "iPhone 16 Pro / 15 Pro" },
  { id: "iphone-55", label: 'iPhone 5.5"', store: "app-store", family: "iphone-classic", width: 1242, height: 2208, note: "iPhone 8 Plus (legacy)" },
  { id: "ipad-13", label: 'iPad 13"', store: "app-store", family: "ipad", width: 2064, height: 2752, note: "iPad Pro M4 · required for iPad", required: true },
  { id: "ipad-129", label: 'iPad 12.9"', store: "app-store", family: "ipad", width: 2048, height: 2732, note: "iPad Pro (2nd gen)" },
  { id: "android-phone", label: "Android phone", store: "google-play", family: "android", width: 1080, height: 1920, note: "9:16 · promo eligible", required: true },
  { id: "android-phone-qhd", label: "Android phone QHD", store: "google-play", family: "android", width: 1440, height: 2560, note: "9:16 high resolution" },
  { id: "android-tablet-7", label: '7" tablet', store: "google-play", family: "android-tablet", width: 1200, height: 1920, note: "Play 7-inch tablet" },
  { id: "android-tablet-10", label: '10" tablet', store: "google-play", family: "android-tablet", width: 1600, height: 2560, note: "Play 10-inch tablet" },
  { id: "play-feature", label: "Feature graphic", store: "google-play", family: "android", width: 1024, height: 500, note: "Play Store banner · 1 per app", required: true },
];

export const PREVIEW_SIZES = ["iphone-69", "ipad-13", "android-phone", "play-feature"];

export function getOutputSize(id: string | null | undefined): OutputSize {
  return OUTPUT_SIZES.find((s) => s.id === id) ?? OUTPUT_SIZES[0];
}

export function defaultSizesFor(platforms: Platform): string[] {
  if (platforms === "ios") return ["iphone-69", "ipad-13"];
  if (platforms === "android") return ["android-phone", "play-feature"];
  return ["iphone-69", "ipad-13", "android-phone", "play-feature"];
}

export function defaultPreviewSize(platforms: Platform): string {
  return platforms === "android" ? "android-phone" : "iphone-69";
}

export interface VideoSize {
  id: string;
  label: string;
  width: number;
  height: number;
  family: DeviceFamily;
  store: "app-store" | "google-play";
  note: string;
}

export const VIDEO_SIZES: VideoSize[] = [
  { id: "iphone-69", label: 'iPhone 6.9" / 6.5"', width: 886, height: 1920, family: "iphone", store: "app-store", note: "App preview · portrait" },
  { id: "iphone-55", label: 'iPhone 5.5"', width: 1080, height: 1920, family: "iphone-classic", store: "app-store", note: "App preview · legacy" },
  { id: "ipad-13", label: 'iPad 13" / 12.9"', width: 1200, height: 1600, family: "ipad", store: "app-store", note: "App preview · portrait" },
  { id: "android-promo", label: "Google Play promo", width: 1080, height: 1920, family: "android", store: "google-play", note: "Portrait 1080p · upload to YouTube" },
];

export function getVideoSize(id: string | null | undefined): VideoSize {
  return VIDEO_SIZES.find((s) => s.id === id) ?? VIDEO_SIZES[0];
}

export const DEVICES: { id: DeviceKind; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Matches the output size" },
  { id: "iphone", label: "iPhone 16 Pro", hint: "Dynamic Island" },
  { id: "iphone-classic", label: "iPhone 8 Plus", hint: "Home button" },
  { id: "ipad", label: "iPad Pro", hint: "13-inch" },
  { id: "pixel", label: "Pixel 9 Pro", hint: "Punch-hole" },
  { id: "galaxy", label: "Galaxy S24", hint: "Slim bezels" },
  { id: "android-tablet", label: "Android tablet", hint: "10-inch" },
  { id: "none", label: "Frameless", hint: "Rounded screen only" },
];

export const FAMILY_DEFAULT_DEVICE: Record<DeviceFamily, ResolvedDevice> = {
  iphone: "iphone",
  "iphone-classic": "iphone-classic",
  ipad: "ipad",
  android: "pixel",
  "android-tablet": "android-tablet",
};

export const FRAME_COLORS = [
  { label: "Black Titanium", hex: "#1C1C1E" },
  { label: "Natural Titanium", hex: "#BFB6A8" },
  { label: "White Titanium", hex: "#E6E3DE" },
  { label: "Desert Titanium", hex: "#C4A88A" },
  { label: "Obsidian", hex: "#2B2B2E" },
  { label: "Hazel", hex: "#8C9A86" },
  { label: "Rose", hex: "#E8C4C4" },
  { label: "Ultramarine", hex: "#5B6CC4" },
];

export const LAYOUTS: { id: LayoutKind; label: string; description: string }[] = [
  { id: "headline-top", label: "Headline top", description: "Classic caption above a cropped device" },
  { id: "headline-bottom", label: "Headline bottom", description: "Device on top, caption below" },
  { id: "tilted", label: "Tilted", description: "Dynamic angled device" },
  { id: "duo", label: "Duo", description: "Two overlapping devices" },
  { id: "frameless", label: "Frameless", description: "Rounded screen, no hardware" },
  { id: "full-bleed", label: "Full bleed", description: "Screen fills the canvas" },
  { id: "big-type", label: "Big type", description: "Oversized editorial headline" },
  { id: "spotlight", label: "Spotlight", description: "Glow behind a centered device" },
  { id: "panorama", label: "Panorama", description: "Background flows across the set" },
];

export const MOCKS: { id: MockKind; label: string }[] = [
  { id: "dashboard", label: "CI dashboard" },
  { id: "terminal", label: "Terminal" },
  { id: "code", label: "Code editor" },
  { id: "pr", label: "Pull request" },
  { id: "chat", label: "AI agent chat" },
  { id: "analytics", label: "Analytics" },
  { id: "issues", label: "Issue tracker" },
  { id: "deploy", label: "Release rollout" },
  { id: "notifications", label: "Lock screen alerts" },
  { id: "onboarding", label: "Onboarding" },
];

export interface FontDef {
  label: string;
  family: string;
  headlineWeight: number;
  bodyFamily: string;
  bodyWeight: number;
  lineHeight: number;
}

export const FONTS: Record<FontKey, FontDef> = {
  inter: { label: "Inter", family: "SS Inter", headlineWeight: 800, bodyFamily: "SS Inter", bodyWeight: 500, lineHeight: 1.08 },
  "space-grotesk": { label: "Space Grotesk", family: "SS Space Grotesk", headlineWeight: 700, bodyFamily: "SS Space Grotesk", bodyWeight: 500, lineHeight: 1.08 },
  "dm-serif": { label: "DM Serif Display", family: "SS DM Serif", headlineWeight: 400, bodyFamily: "SS Inter", bodyWeight: 500, lineHeight: 1.06 },
  "jetbrains-mono": { label: "JetBrains Mono", family: "SS JetBrains Mono", headlineWeight: 700, bodyFamily: "SS JetBrains Mono", bodyWeight: 400, lineHeight: 1.12 },
  poppins: { label: "Poppins", family: "SS Poppins", headlineWeight: 700, bodyFamily: "SS Poppins", bodyWeight: 500, lineHeight: 1.12 },
};

export const FONT_FILES: { family: string; weight: number; file: string }[] = [
  { family: "SS Inter", weight: 400, file: "inter-400.ttf" },
  { family: "SS Inter", weight: 500, file: "inter-500.ttf" },
  { family: "SS Inter", weight: 600, file: "inter-600.ttf" },
  { family: "SS Inter", weight: 700, file: "inter-700.ttf" },
  { family: "SS Inter", weight: 800, file: "inter-800.ttf" },
  { family: "SS Space Grotesk", weight: 500, file: "space-grotesk-500.ttf" },
  { family: "SS Space Grotesk", weight: 700, file: "space-grotesk-700.ttf" },
  { family: "SS DM Serif", weight: 400, file: "dm-serif-display-400.ttf" },
  { family: "SS JetBrains Mono", weight: 400, file: "jetbrains-mono-400.ttf" },
  { family: "SS JetBrains Mono", weight: 700, file: "jetbrains-mono-700.ttf" },
  { family: "SS Poppins", weight: 500, file: "poppins-500.ttf" },
  { family: "SS Poppins", weight: 600, file: "poppins-600.ttf" },
  { family: "SS Poppins", weight: 700, file: "poppins-700.ttf" },
  { family: "SS Poppins", weight: 800, file: "poppins-800.ttf" },
];

export const BACKGROUND_PRESETS: { name: string; background: Background; textColor: string; accentColor: string }[] = [
  { name: "Aurora", background: { type: "mesh", colors: ["#0B1026", "#6366F1", "#22D3EE", "#A855F7"], angle: 160 }, textColor: "#FFFFFF", accentColor: "#67E8F9" },
  { name: "Sunset", background: { type: "linear", colors: ["#F97316", "#EC4899"], angle: 160 }, textColor: "#FFFFFF", accentColor: "#FEF08A" },
  { name: "Midnight", background: { type: "radial", colors: ["#05060A", "#312E81"], angle: 0 }, textColor: "#F8FAFC", accentColor: "#A5B4FC" },
  { name: "Blueprint", background: { type: "grid", colors: ["#0A1628", "#38BDF8"], angle: 0 }, textColor: "#E0F2FE", accentColor: "#38BDF8" },
  { name: "Terminal", background: { type: "grid", colors: ["#050A07", "#10B981"], angle: 0 }, textColor: "#ECFDF5", accentColor: "#4ADE80" },
  { name: "Paper", background: { type: "solid", colors: ["#F5F1E8"], angle: 0 }, textColor: "#1C1917", accentColor: "#EA580C" },
  { name: "Mist", background: { type: "linear", colors: ["#F8FAFC", "#E0E7FF"], angle: 180 }, textColor: "#0F172A", accentColor: "#4F46E5" },
  { name: "Mint", background: { type: "dots", colors: ["#ECFDF5", "#10B981"], angle: 0 }, textColor: "#064E3B", accentColor: "#059669" },
  { name: "Ember", background: { type: "mesh", colors: ["#1A0B05", "#F97316", "#DC2626", "#FBBF24"], angle: 0 }, textColor: "#FFF7ED", accentColor: "#FDBA74" },
  { name: "Lilac", background: { type: "linear", colors: ["#C4B5FD", "#F0ABFC", "#FDE68A"], angle: 135 }, textColor: "#1E1B4B", accentColor: "#7C3AED" },
  { name: "Peach", background: { type: "linear", colors: ["#FFEDD5", "#FBCFE8", "#E9D5FF"], angle: 90 }, textColor: "#1C1917", accentColor: "#EA580C" },
  { name: "Graphite", background: { type: "dots", colors: ["#111113", "#71717A"], angle: 0 }, textColor: "#FAFAFA", accentColor: "#FACC15" },
];

export const TRANSITIONS: { id: TransitionKind; label: string }[] = [
  { id: "fade", label: "Cross-fade" },
  { id: "slide", label: "Slide" },
  { id: "push", label: "Push up" },
  { id: "zoom", label: "Zoom" },
  { id: "none", label: "Cut" },
];

export const MOTIONS: { id: MotionKind; label: string }[] = [
  { id: "rise", label: "Rise in" },
  { id: "zoom-in", label: "Ken Burns" },
  { id: "scroll", label: "Scroll screen" },
  { id: "float", label: "Float" },
  { id: "pan", label: "Pan" },
  { id: "none", label: "Static" },
];

export const CATEGORIES = [
  "Developer Tools",
  "Productivity",
  "Utilities",
  "Business",
  "Finance",
  "Education",
  "Health & Fitness",
  "Lifestyle",
  "Social Networking",
  "Games",
];

export const TEMPLATE_CATEGORIES = ["Bold", "Minimal", "Dark", "Playful", "Editorial", "Custom"];
