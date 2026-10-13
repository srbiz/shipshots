"use client";

import { DEFAULT_SPEC, normalizeSpec } from "@/lib/types";
import { ShotCanvas } from "./shot-canvas";

const SHOTS = [
  normalizeSpec({ ...DEFAULT_SPEC, eyebrow: "CI/CD for mobile", headline: "Every build.\n*Every branch.*", subheadline: "Live pipelines in your pocket.", screen: { kind: "mock", mock: "dashboard", dark: true } }),
  normalizeSpec({ ...DEFAULT_SPEC, layout: "tilted", tilt: 10, background: { type: "linear", colors: ["#F97316", "#EC4899"], angle: 160 }, accentColor: "#FEF08A", font: "poppins", textAlign: "left", headline: "Review PRs *anywhere*", subheadline: "Inline diffs on the go.", screen: { kind: "mock", mock: "pr", dark: false } }),
  normalizeSpec({ ...DEFAULT_SPEC, background: { type: "grid", colors: ["#050A07", "#10B981"], angle: 0 }, textColor: "#ECFDF5", accentColor: "#4ADE80", font: "jetbrains-mono", textAlign: "left", headline: "SSH into *anything*", subheadline: "Built for iPhone and iPad.", screen: { kind: "mock", mock: "terminal", dark: true } }),
];

export function AuthShowcase() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.25),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.15),transparent_55%)]" />
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="relative flex items-center gap-5 px-8">
        {SHOTS.map((s, i) => (
          <div
            key={i}
            className="animate-float w-[170px] shrink-0 xl:w-[200px]"
            style={{ ["--r" as string]: `${(i - 1) * 4}deg`, animationDelay: `${i * -2}s`, marginTop: i === 1 ? -40 : 40 }}
          >
            <ShotCanvas spec={s} sizeId="iphone-69" className="shadow-2xl shadow-black/60 ring-1 ring-white/10" brandColor={i === 1 ? "#F97316" : i === 2 ? "#10B981" : "#6366F1"} appName={["Shipyard", "Pocket PR", "Terminus"][i]} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-10 left-0 right-0 px-10 text-center">
        <p className="text-sm font-medium text-zinc-200">Device frames · 9 layouts · fastlane-ready ZIPs · MP4 app previews</p>
        <p className="mt-1 text-xs text-zinc-500">Runs locally beside your app. Scriptable by Claude Code, Cursor & friends via REST.</p>
      </div>
    </div>
  );
}
