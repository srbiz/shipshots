import { normalizeStyle, type StyleSpec } from "./types";

export interface BuiltinTemplate {
  key: string;
  name: string;
  description: string;
  category: string;
  spec: StyleSpec;
}

const t = (key: string, name: string, category: string, description: string, spec: Record<string, unknown>): BuiltinTemplate => ({
  key,
  name,
  category,
  description,
  spec: normalizeStyle(spec),
});

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  t("aurora", "Aurora", "Bold", "Glowing mesh gradient with a centered headline — the crowd favorite.", {
    layout: "headline-top", background: { type: "mesh", colors: ["#0B1026", "#6366F1", "#22D3EE", "#A855F7"], angle: 160 }, textColor: "#FFFFFF", accentColor: "#67E8F9", font: "inter", textAlign: "center",
  }),
  t("blueprint", "Blueprint", "Dark", "Engineering grid, left-aligned grotesk type. Built for dev tools.", {
    layout: "headline-top", background: { type: "grid", colors: ["#0A1628", "#38BDF8"], angle: 0 }, textColor: "#E0F2FE", accentColor: "#38BDF8", font: "space-grotesk", textAlign: "left", eyebrowStyle: "plain",
  }),
  t("tilt-shift", "Tilt Shift", "Playful", "Angled device over a warm sunset gradient.", {
    layout: "tilted", tilt: 12, background: { type: "linear", colors: ["#F97316", "#EC4899"], angle: 160 }, textColor: "#FFFFFF", accentColor: "#FEF08A", font: "poppins", textAlign: "left",
  }),
  t("duo-stack", "Duo Stack", "Bold", "Two overlapping devices to show a flow in one frame.", {
    layout: "duo", background: { type: "radial", colors: ["#0F0A1F", "#7C3AED", "#EC4899"], angle: 0 }, textColor: "#FFFFFF", accentColor: "#F0ABFC", font: "inter", textAlign: "center",
  }),
  t("editorial", "Editorial", "Editorial", "Oversized serif headline on warm paper.", {
    layout: "big-type", background: { type: "solid", colors: ["#F5F1E8"], angle: 0 }, textColor: "#1C1917", accentColor: "#EA580C", font: "dm-serif", textAlign: "left", frameColor: "#E6E3DE",
  }),
  t("spotlight", "Spotlight", "Dark", "Centered device with a soft glow and caption below.", {
    layout: "spotlight", background: { type: "radial", colors: ["#05060A", "#1E1B4B"], angle: 0 }, textColor: "#F8FAFC", accentColor: "#818CF8", font: "inter", textAlign: "center",
  }),
  t("soft-frameless", "Soft Frameless", "Minimal", "Rounded screen without hardware on a calm gradient.", {
    layout: "frameless", background: { type: "linear", colors: ["#F8FAFC", "#E0E7FF"], angle: 180 }, textColor: "#0F172A", accentColor: "#4F46E5", font: "inter", textAlign: "center",
  }),
  t("full-bleed", "Full Bleed", "Bold", "Your UI edge to edge with a caption scrim.", {
    layout: "full-bleed", background: { type: "solid", colors: ["#0B0D12"], angle: 0 }, textColor: "#FFFFFF", accentColor: "#FBBF24", font: "space-grotesk", textAlign: "left",
  }),
  t("panorama-flow", "Panorama Flow", "Playful", "One continuous background that flows across the whole set.", {
    layout: "panorama", background: { type: "mesh", colors: ["#FFF7ED", "#FDBA74", "#F9A8D4", "#C4B5FD"], angle: 90 }, textColor: "#1C1917", accentColor: "#EA580C", font: "poppins", textAlign: "center", frameColor: "#E6E3DE",
  }),
  t("bottom-line", "Bottom Line", "Minimal", "Device first, caption anchored to the bottom.", {
    layout: "headline-bottom", background: { type: "dots", colors: ["#ECFDF5", "#10B981"], angle: 0 }, textColor: "#064E3B", accentColor: "#059669", font: "inter", textAlign: "center", frameColor: "#E6E3DE",
  }),
  t("terminal-green", "Terminal Green", "Dark", "Phosphor green on black with monospace type.", {
    layout: "headline-top", background: { type: "grid", colors: ["#050A07", "#10B981"], angle: 0 }, textColor: "#ECFDF5", accentColor: "#4ADE80", font: "jetbrains-mono", textAlign: "left", eyebrowStyle: "plain", frameColor: "#2B2B2E",
  }),
  t("cupertino", "Cupertino", "Minimal", "Clean light gray, crisp type — feels first-party.", {
    layout: "headline-top", background: { type: "solid", colors: ["#F5F5F7"], angle: 0 }, textColor: "#1D1D1F", accentColor: "#0071E3", font: "inter", textAlign: "center",
  }),
];
