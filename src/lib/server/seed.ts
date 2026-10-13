import { asc, eq } from "drizzle-orm";
import JSZip from "jszip";
import { db } from "@/db";
import { projects, screenshots, templates, users, videos } from "@/db/schema";
import { BUILTIN_TEMPLATES } from "@/lib/builtin-templates";
import { getOutputSize } from "@/lib/catalog";
import { exportPath, slugify, pad2 } from "@/lib/export-paths";
import { renderMockPng, renderScreenshotBuffer } from "@/lib/render/server";
import { DEFAULT_SPEC, normalizeSpec, normalizeStyle, randomId, type ScreenshotSpec, type VideoScene } from "@/lib/types";
import { hashPassword } from "./auth";
import { createAsset, createExport, createKey } from "./data";

export const DEMO_EMAIL = "demo@shipshots.dev";
export const DEMO_PASSWORD = "demo1234";

let seeding: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = doSeed().catch((e) => {
      console.error("[seed] failed", e);
      seeding = null;
    });
  }
  return seeding;
}

async function ensureBuiltinTemplates() {
  const rows = await db.select({ key: templates.key }).from(templates).where(eq(templates.isBuiltin, true));
  const have = new Set(rows.map((r) => r.key));
  const missing = BUILTIN_TEMPLATES.filter((t) => !have.has(t.key));
  if (!missing.length) return;
  const base = Date.now() - 1000 * 60 * 60 * 24 * 30;
  await db.insert(templates).values(
    missing.map((t) => ({ key: t.key, name: t.name, description: t.description, category: t.category, isBuiltin: true, spec: t.spec, createdAt: new Date(base + BUILTIN_TEMPLATES.indexOf(t) * 1000) })),
  );
}

async function doSeed() {
  await ensureBuiltinTemplates();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing) return;
  await seedDemo();
}

const MIN = 60_000;
const ago = (mins: number) => new Date(Date.now() - mins * MIN);
const mock = (m: string, dark = true) => ({ kind: "mock", mock: m, dark });

async function seedDemo() {
  const [user] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, name: "Avery Chen", passwordHash: await hashPassword(DEMO_PASSWORD), createdAt: ago(60 * 24 * 21) })
    .returning();
  const uid = user.id;

  // ---------- Shipyard ----------
  const [shipyard] = await db
    .insert(projects)
    .values({
      userId: uid,
      name: "Shipyard",
      tagline: "CI/CD in your pocket",
      description: "Monitor GitHub Actions, Bitrise and CircleCI pipelines, review pull requests and ship releases from your phone.",
      platforms: "both",
      bundleId: "dev.shipyard.app",
      category: "Developer Tools",
      primaryColor: "#6366F1",
      accentColor: "#22D3EE",
      font: "inter",
      createdAt: ago(60 * 24 * 14),
      updatedAt: ago(12),
    })
    .returning();
  const shipBase = normalizeSpec({ ...DEFAULT_SPEC, background: { type: "mesh", colors: ["#0B1026", "#6366F1", "#22D3EE", "#A855F7"], angle: 160 }, textColor: "#FFFFFF", accentColor: "#67E8F9", font: "inter" });
  const shipShots = await insertShots(shipyard.id, shipBase, [
    { name: "Builds overview", eyebrow: "CI/CD for mobile teams", headline: "Every build.\n*Every branch.*", subheadline: "Live status for GitHub Actions, Bitrise and CircleCI in one place.", screen: mock("dashboard") },
    { name: "Readable logs", headline: "Fix failures *before standup*", subheadline: "Streaming logs with smart error highlighting.", screen: mock("terminal"), layout: "tilted", tilt: 10 },
    { name: "Code review", headline: "Review PRs *anywhere*", subheadline: "Inline diffs, comments and approvals on the go.", screen: mock("pr"), screen2: mock("code"), layout: "duo" },
    { name: "Releases", headline: "Ship with *one tap*", subheadline: "Staged rollouts to the App Store and Google Play.", screen: mock("deploy"), layout: "headline-bottom" },
    { name: "Alerts", headline: "Never miss a *red build*", subheadline: "Actionable push alerts for the pipelines you own.", screen: mock("notifications"), layout: "spotlight", background: { type: "radial", colors: ["#05060A", "#312E81"], angle: 0 }, accentColor: "#A5B4FC" },
    { name: "AI teammate", eyebrow: "4.9 · 2,300 ratings", eyebrowStyle: "stars", headline: "Your on-call *AI teammate*", subheadline: "Ask why a build broke and let the agent ship the fix.", screen: mock("chat") },
  ], 12);

  // ---------- Terminus ----------
  const [terminus] = await db
    .insert(projects)
    .values({
      userId: uid,
      name: "Terminus",
      tagline: "SSH & code editor for iPhone and iPad",
      description: "A fast SSH/Mosh client with a real code editor, Git and an AI pair programmer.",
      platforms: "ios",
      bundleId: "io.terminus.mobile",
      category: "Developer Tools",
      primaryColor: "#10B981",
      accentColor: "#A3E635",
      font: "jetbrains-mono",
      createdAt: ago(60 * 24 * 9),
      updatedAt: ago(60 * 3),
    })
    .returning();
  let onboardingAssetId: string | null = null;
  try {
    const png = await renderMockPng("onboarding", false, "#10B981", 1206, 2622, { platform: "ios", appName: "Terminus" });
    onboardingAssetId = (await createAsset(uid, { name: "simulator-onboarding.png", data: png, projectId: terminus.id, createdAt: ago(60 * 26) })).id;
    const ipad = await renderMockPng("code", true, "#10B981", 2064, 2752, { platform: "ios", tablet: true, appName: "Terminus" });
    await createAsset(uid, { name: "ipad-editor-capture.png", data: ipad, projectId: terminus.id, createdAt: ago(60 * 25) });
  } catch (e) {
    console.error("[seed] asset render failed", e);
  }
  const termBase = normalizeSpec({ ...DEFAULT_SPEC, background: { type: "grid", colors: ["#050A07", "#10B981"], angle: 0 }, textColor: "#ECFDF5", accentColor: "#4ADE80", font: "jetbrains-mono", textAlign: "left", eyebrowStyle: "plain", frameColor: "#2B2B2E" });
  const termShots = await insertShots(terminus.id, termBase, [
    { name: "SSH", eyebrow: "Terminus Pro", headline: "SSH into *anything*", subheadline: "Mosh, SSH keys and jump hosts, built for iPhone and iPad.", screen: mock("terminal") },
    { name: "Editor", headline: "A real *code editor*", subheadline: "Syntax highlighting for 80+ languages with Git built in.", screen: mock("code"), layout: "big-type", headlineScale: 0.8 },
    { name: "AI pair", headline: "Pair with an *AI agent*", subheadline: "Explain errors, write scripts and run them in one tap.", screen: mock("chat"), layout: "frameless" },
    { name: "Servers", headline: "Servers *at a glance*", subheadline: "CPU, memory and uptime for every host.", screen: mock("analytics"), layout: "tilted", tilt: -10 },
    { name: "Setup", headline: "Set up in *30 seconds*", subheadline: "Import keys from 1Password, GitHub or your Mac.", screen: onboardingAssetId ? { kind: "asset", assetId: onboardingAssetId } : mock("onboarding", false) },
  ], 180);

  // ---------- Pocket PR ----------
  const [pocket] = await db
    .insert(projects)
    .values({
      userId: uid,
      name: "Pocket PR",
      tagline: "Code review that fits your pocket",
      description: "GitHub and GitLab pull requests, issues and AI summaries — beautifully native on Android.",
      platforms: "android",
      bundleId: "app.pocketpr.android",
      category: "Productivity",
      primaryColor: "#F97316",
      accentColor: "#EC4899",
      font: "poppins",
      createdAt: ago(60 * 24 * 4),
      updatedAt: ago(60 * 26),
    })
    .returning();
  try {
    const pix = await renderMockPng("issues", false, "#F97316", 1080, 2400, { platform: "android", appName: "Pocket PR" });
    await createAsset(uid, { name: "pixel-8-issues.png", data: pix, projectId: pocket.id, createdAt: ago(60 * 30) });
  } catch (e) {
    console.error("[seed] asset render failed", e);
  }
  const pocketBase = normalizeSpec({ ...DEFAULT_SPEC, layout: "panorama", background: { type: "mesh", colors: ["#FFF7ED", "#FDBA74", "#F9A8D4", "#C4B5FD"], angle: 90 }, textColor: "#1C1917", accentColor: "#EA580C", font: "poppins", frameColor: "#E6E3DE" });
  await insertShots(pocket.id, pocketBase, [
    { name: "Hero", headline: "Code review that *fits your pocket*", subheadline: "GitHub and GitLab pull requests, beautifully native.", screen: mock("pr", false) },
    { name: "Triage", headline: "Triage issues in *seconds*", subheadline: "Swipe to label, assign and close.", screen: mock("issues", false) },
    { name: "AI summaries", headline: "Ask the *repo* anything", subheadline: "AI summaries of every diff and thread.", screen: mock("chat", false) },
    { name: "Velocity", headline: "Know your *review velocity*", subheadline: "Cycle time, review load and merge trends.", screen: mock("analytics", false) },
  ], 60 * 26);

  // ---------- Videos ----------
  const scene = (id: string, motion: VideoScene["motion"], transition: VideoScene["transition"], duration = 4): VideoScene => ({ id: randomId(), screenshotId: id, duration, motion, transition });
  await db.insert(videos).values([
    {
      projectId: shipyard.id,
      name: "App Store preview · iPhone",
      size: "iphone-69",
      fps: 30,
      scenes: [scene(shipShots[0], "rise", "fade"), scene(shipShots[1], "scroll", "slide"), scene(shipShots[2], "float", "slide"), scene(shipShots[3], "zoom-in", "zoom"), scene(shipShots[5], "rise", "push")],
      settings: { transitionDuration: 0.6, outro: { enabled: true, title: "", subtitle: "", duration: 3, badge: "app-store" } },
      createdAt: ago(60 * 24 * 2),
      updatedAt: ago(45),
    },
    {
      projectId: shipyard.id,
      name: "Google Play promo",
      size: "android-promo",
      fps: 30,
      scenes: [scene(shipShots[0], "zoom-in", "fade", 4), scene(shipShots[3], "rise", "slide", 4), scene(shipShots[4], "float", "fade", 4)],
      settings: { transitionDuration: 0.6, outro: { enabled: true, title: "", subtitle: "Get it on Google Play", duration: 3, badge: "google-play" } },
      createdAt: ago(60 * 24),
      updatedAt: ago(60 * 20),
    },
    {
      projectId: terminus.id,
      name: "iPhone preview",
      size: "iphone-69",
      fps: 30,
      scenes: [scene(termShots[0], "rise", "fade", 5), scene(termShots[1], "scroll", "slide", 5), scene(termShots[2], "float", "zoom", 4), scene(termShots[3], "pan", "slide", 4)],
      settings: { transitionDuration: 0.6, outro: { enabled: true, title: "", subtitle: "", duration: 3, badge: "app-store" } },
      createdAt: ago(60 * 24 * 3),
      updatedAt: ago(60 * 5),
    },
  ]);

  // ---------- Custom template & API keys ----------
  await db.insert(templates).values({
    userId: uid,
    name: "Shipyard Midnight",
    description: "Brand spotlight style for Shipyard launches.",
    category: "Custom",
    isBuiltin: false,
    spec: normalizeStyle({ ...shipBase, layout: "spotlight", background: { type: "radial", colors: ["#05060A", "#312E81", "#0E7490"], angle: 0 }, accentColor: "#A5B4FC" }),
    createdAt: ago(60 * 24 * 5),
  });
  await createKey(uid, "Claude Code · MacBook", { createdAt: ago(60 * 24 * 6), lastUsedAt: ago(38) });
  await createKey(uid, "GitHub Actions · release", { createdAt: ago(60 * 24 * 3), lastUsedAt: ago(60 * 22) });
  await createKey(uid, "Old laptop", { createdAt: ago(60 * 24 * 18), lastUsedAt: ago(60 * 24 * 12), revokedAt: ago(60 * 24 * 10) });

  // Rendered exports are generated in the background so first load stays fast.
  void seedExports(uid, shipyard, terminus.id, pocket.id).catch((e) => console.error("[seed] exports failed", e));
}

async function insertShots(projectId: string, base: ScreenshotSpec, items: Record<string, unknown>[], minutesAgo: number): Promise<string[]> {
  const rows = await db
    .insert(screenshots)
    .values(
      items.map((it, i) => {
        const { name, ...spec } = it;
        return { projectId, position: i, name: String(name), spec: normalizeSpec({ ...base, eyebrow: "", ...spec }), createdAt: ago(minutesAgo + 600 - i), updatedAt: ago(minutesAgo + i * 7) };
      }),
    )
    .returning({ id: screenshots.id, position: screenshots.position });
  return rows.sort((a, b) => a.position - b.position).map((r) => r.id);
}

async function seedExports(uid: string, shipyard: typeof projects.$inferSelect, terminusId: string, pocketId: string) {
  const load = async (pid: string) => db.select().from(screenshots).where(eq(screenshots.projectId, pid)).orderBy(asc(screenshots.position));
  const ship = await load(shipyard.id);
  const zip = new JSZip();
  const files: string[] = [];
  for (const sizeId of ["iphone-69", "android-phone", "play-feature"]) {
    const size = getOutputSize(sizeId);
    for (let i = 0; i < ship.length; i++) {
      const path = exportPath("fastlane", size, i, ship[i].spec.headline, "png");
      if (!path) continue;
      const out = await renderScreenshotBuffer(normalizeSpec(ship[i].spec), sizeId, { images: {}, appName: "Shipyard", brandColor: "#6366F1", panorama: { index: i, count: ship.length }, format: "png" });
      zip.file(path, out.buffer);
      files.push(path);
      if (sizeId === "iphone-69" && i < 2) {
        await createExport(uid, { projectId: shipyard.id, kind: "image", name: `shipyard-${pad2(i + 1)}-iphone-69.png`, mimeType: "image/png", width: out.width, height: out.height, source: "api", meta: { size: sizeId, agent: "Claude Code · MacBook" }, data: out.buffer, createdAt: ago(40 - i) });
      }
    }
  }
  zip.file("manifest.json", JSON.stringify({ project: "Shipyard", layout: "fastlane", files }, null, 2));
  const zbuf = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  await createExport(uid, { projectId: shipyard.id, kind: "archive", name: `${slugify("Shipyard")}-fastlane.zip`, mimeType: "application/zip", source: "api", meta: { sizes: ["iphone-69", "android-phone", "play-feature"], files: files.length, layout: "fastlane" }, data: zbuf, createdAt: ago(36) });

  const term = await load(terminusId);
  if (term[0]) {
    const out = await renderScreenshotBuffer(normalizeSpec(term[0].spec), "ipad-13", { images: {}, appName: "Terminus", brandColor: "#10B981", format: "png" });
    await createExport(uid, { projectId: terminusId, kind: "image", name: "terminus-01-ipad-13.png", mimeType: "image/png", width: out.width, height: out.height, source: "editor", meta: { size: "ipad-13" }, data: out.buffer, createdAt: ago(60 * 4) });
  }
  const pocket = await load(pocketId);
  if (pocket[0]) {
    const out = await renderScreenshotBuffer(normalizeSpec(pocket[0].spec), "android-phone", { images: {}, appName: "Pocket PR", brandColor: "#F97316", panorama: { index: 0, count: pocket.length }, format: "jpeg" });
    await createExport(uid, { projectId: pocketId, kind: "image", name: "pocket-pr-01-android-phone.jpg", mimeType: "image/jpeg", width: out.width, height: out.height, source: "editor", meta: { size: "android-phone" }, data: out.buffer, createdAt: ago(60 * 27) });
  }
}
