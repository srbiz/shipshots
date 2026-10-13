import { and, asc, count, desc, eq, gt, inArray, or, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, assets, exportsTable, projects, screenshots, templates, users, videos } from "@/db/schema";
import { VIDEO_SIZES } from "@/lib/catalog";
import { darken, lighten, mix } from "@/lib/render/canvas-utils";
import {
  DEFAULT_SPEC,
  DEFAULT_VIDEO_SETTINGS,
  normalizeScenes,
  normalizeSpec,
  normalizeStyle,
  normalizeVideoSettings,
  randomId,
  type ApiKeyDTO,
  type AssetDTO,
  type ExportDTO,
  type FontKey,
  type MotionKind,
  type Platform,
  type ProjectDTO,
  type ScreenshotDTO,
  type ScreenshotSpec,
  type TemplateDTO,
  type TransitionKind,
  type VideoDTO,
} from "@/lib/types";
import { generateApiKey, hashPassword, verifyPassword } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID_RE.test(s);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

type ProjectRow = typeof projects.$inferSelect;
type ShotRow = typeof screenshots.$inferSelect;
type VideoRow = typeof videos.$inferSelect;
type TemplateRow = typeof templates.$inferSelect;

export const projectDTO = (r: ProjectRow): ProjectDTO => ({
  id: r.id,
  name: r.name,
  tagline: r.tagline,
  description: r.description,
  platforms: (["ios", "android", "both"].includes(r.platforms) ? r.platforms : "both") as Platform,
  bundleId: r.bundleId,
  category: r.category,
  primaryColor: r.primaryColor,
  accentColor: r.accentColor,
  font: r.font as FontKey,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export const shotDTO = (r: ShotRow): ScreenshotDTO => ({
  id: r.id,
  projectId: r.projectId,
  position: r.position,
  name: r.name,
  spec: normalizeSpec(r.spec),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export const videoDTO = (r: VideoRow): VideoDTO => ({
  id: r.id,
  projectId: r.projectId,
  name: r.name,
  size: r.size,
  fps: r.fps,
  scenes: normalizeScenes(r.scenes),
  settings: normalizeVideoSettings(r.settings),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export const templateDTO = (r: TemplateRow): TemplateDTO => ({
  id: r.id,
  name: r.name,
  description: r.description,
  category: r.category,
  isBuiltin: r.isBuiltin,
  spec: normalizeStyle(r.spec),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export function brandStyle(p: { primaryColor: string; accentColor: string; font: string }): Partial<ScreenshotSpec> {
  return {
    background: { type: "mesh", colors: [darken(p.primaryColor, 0.82), p.primaryColor, p.accentColor, mix(p.primaryColor, p.accentColor, 0.5)], angle: 160 },
    accentColor: lighten(p.accentColor, 0.25).toUpperCase(),
    textColor: "#FFFFFF",
    font: p.font as FontKey,
  };
}

async function touchProject(id: string) {
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));
}

// ---------------- Projects ----------------
export async function listProjects(userId: string): Promise<ProjectDTO[]> {
  const rows = await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const shots = await db
    .select({ projectId: screenshots.projectId, spec: screenshots.spec })
    .from(screenshots)
    .where(inArray(screenshots.projectId, ids))
    .orderBy(asc(screenshots.position), asc(screenshots.createdAt));
  const vids = await db.select({ projectId: videos.projectId, n: count() }).from(videos).where(inArray(videos.projectId, ids)).groupBy(videos.projectId);
  return rows.map((r) => {
    const s = shots.filter((x) => x.projectId === r.id);
    return {
      ...projectDTO(r),
      screenshotCount: s.length,
      videoCount: Number(vids.find((v) => v.projectId === r.id)?.n ?? 0),
      previewSpecs: s.slice(0, 3).map((x) => normalizeSpec(x.spec)),
    };
  });
}

export async function ownedProject(userId: string, id: string): Promise<ProjectRow> {
  if (!isUuid(id)) throw new HttpError(404, "Project not found");
  const [r] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
  if (!r) throw new HttpError(404, "Project not found");
  return r;
}

export async function getProjectDetail(userId: string, id: string) {
  const p = await ownedProject(userId, id);
  const shots = await db.select().from(screenshots).where(eq(screenshots.projectId, id)).orderBy(asc(screenshots.position), asc(screenshots.createdAt));
  const vids = await db.select().from(videos).where(eq(videos.projectId, id)).orderBy(desc(videos.updatedAt));
  return { project: projectDTO(p), screenshots: shots.map(shotDTO), videos: vids.map(videoDTO) };
}

export interface ProjectInput {
  name: string;
  tagline?: string;
  description?: string;
  platforms?: Platform;
  bundleId?: string;
  category?: string;
  primaryColor?: string;
  accentColor?: string;
  font?: FontKey;
  templateId?: string;
  starter?: boolean;
}

export async function createProject(userId: string, input: ProjectInput): Promise<ProjectDTO> {
  const [p] = await db
    .insert(projects)
    .values({
      userId,
      name: input.name.trim(),
      tagline: input.tagline ?? "",
      description: input.description ?? "",
      platforms: input.platforms ?? "both",
      bundleId: input.bundleId ?? "",
      category: input.category ?? "Developer Tools",
      primaryColor: input.primaryColor ?? "#6366F1",
      accentColor: input.accentColor ?? "#22D3EE",
      font: input.font ?? "inter",
    })
    .returning();
  if (input.starter !== false) {
    let style: Partial<ScreenshotSpec> = brandStyle(p);
    if (input.templateId) {
      const t = await visibleTemplate(userId, input.templateId).catch(() => null);
      if (t) style = { ...normalizeStyle(t.spec) };
    }
    const starters: Partial<ScreenshotSpec>[] = [
      { headline: input.tagline?.trim() ? input.tagline.trim() : `Meet *${p.name}*`, subheadline: "Lead with your strongest value proposition.", screen: { kind: "mock", mock: "dashboard", dark: true } },
      { headline: "Everything at a *glance*", subheadline: "Show the screen your users love most.", screen: { kind: "mock", mock: "analytics", dark: true } },
      { headline: "Built for *speed*", subheadline: "Upload a simulator capture to replace this mock UI.", screen: { kind: "mock", mock: "chat", dark: true } },
    ];
    await db.insert(screenshots).values(
      starters.map((s, i) => ({ projectId: p.id, position: i, name: ["Hero", "Feature 1", "Feature 2"][i], spec: normalizeSpec({ ...DEFAULT_SPEC, ...style, ...s, eyebrow: "" }) })),
    );
  }
  return projectDTO(p);
}

export async function updateProject(userId: string, id: string, patch: Partial<ProjectInput>): Promise<ProjectDTO> {
  await ownedProject(userId, id);
  const set: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.tagline !== undefined) set.tagline = patch.tagline;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.platforms !== undefined) set.platforms = patch.platforms;
  if (patch.bundleId !== undefined) set.bundleId = patch.bundleId;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.primaryColor !== undefined) set.primaryColor = patch.primaryColor;
  if (patch.accentColor !== undefined) set.accentColor = patch.accentColor;
  if (patch.font !== undefined) set.font = patch.font;
  const [r] = await db.update(projects).set(set).where(eq(projects.id, id)).returning();
  return projectDTO(r);
}

export async function deleteProject(userId: string, id: string) {
  await ownedProject(userId, id);
  await db.delete(projects).where(eq(projects.id, id));
}

export async function duplicateProject(userId: string, id: string): Promise<ProjectDTO> {
  const p = await ownedProject(userId, id);
  const [np] = await db
    .insert(projects)
    .values({ userId, name: `${p.name} copy`, tagline: p.tagline, description: p.description, platforms: p.platforms, bundleId: p.bundleId, category: p.category, primaryColor: p.primaryColor, accentColor: p.accentColor, font: p.font })
    .returning();
  const shots = await db.select().from(screenshots).where(eq(screenshots.projectId, id));
  const idMap = new Map<string, string>();
  for (const s of shots) {
    const [ns] = await db.insert(screenshots).values({ projectId: np.id, position: s.position, name: s.name, spec: s.spec }).returning({ id: screenshots.id });
    idMap.set(s.id, ns.id);
  }
  const vids = await db.select().from(videos).where(eq(videos.projectId, id));
  for (const v of vids) {
    await db.insert(videos).values({
      projectId: np.id,
      name: v.name,
      size: v.size,
      fps: v.fps,
      settings: v.settings,
      scenes: normalizeScenes(v.scenes)
        .filter((sc) => idMap.has(sc.screenshotId))
        .map((sc) => ({ ...sc, screenshotId: idMap.get(sc.screenshotId)! })),
    });
  }
  return projectDTO(np);
}

// ---------------- Screenshots ----------------
export async function ownedScreenshot(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Screenshot not found");
  const rows = await db
    .select({ shot: screenshots, project: projects })
    .from(screenshots)
    .innerJoin(projects, eq(projects.id, screenshots.projectId))
    .where(and(eq(screenshots.id, id), eq(projects.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new HttpError(404, "Screenshot not found");
  return rows[0];
}

export async function listScreenshots(userId: string, projectId: string): Promise<ScreenshotDTO[]> {
  await ownedProject(userId, projectId);
  const rows = await db.select().from(screenshots).where(eq(screenshots.projectId, projectId)).orderBy(asc(screenshots.position), asc(screenshots.createdAt));
  return rows.map(shotDTO);
}

export async function createScreenshot(userId: string, projectId: string, input: { name?: string; spec?: unknown; templateId?: string }): Promise<ScreenshotDTO> {
  const p = await ownedProject(userId, projectId);
  const existing = await db
    .select({ position: screenshots.position, spec: screenshots.spec })
    .from(screenshots)
    .where(eq(screenshots.projectId, projectId))
    .orderBy(asc(screenshots.position));
  const last = existing[existing.length - 1];
  let base: ScreenshotSpec = last
    ? normalizeSpec({ ...normalizeSpec(last.spec), headline: "New *headline*", subheadline: "Describe the benefit in one short line.", eyebrow: "" })
    : normalizeSpec({ ...DEFAULT_SPEC, ...brandStyle(p) });
  if (input.templateId) {
    const t = await visibleTemplate(userId, input.templateId);
    base = normalizeSpec({ ...base, ...normalizeStyle(t.spec) });
  }
  const spec = normalizeSpec(input.spec ?? {}, base);
  const position = existing.length ? Math.max(...existing.map((e) => e.position)) + 1 : 0;
  const [r] = await db
    .insert(screenshots)
    .values({ projectId, position, name: input.name?.trim().slice(0, 80) || `Screenshot ${existing.length + 1}`, spec })
    .returning();
  await touchProject(projectId);
  return shotDTO(r);
}

export async function updateScreenshot(userId: string, id: string, patch: { name?: string; spec?: unknown }): Promise<ScreenshotDTO> {
  const { shot } = await ownedScreenshot(userId, id);
  const current = normalizeSpec(shot.spec);
  const spec = patch.spec !== undefined ? normalizeSpec(patch.spec, current) : current;
  const [r] = await db
    .update(screenshots)
    .set({ spec, ...(patch.name !== undefined ? { name: patch.name.slice(0, 80) } : {}), updatedAt: new Date() })
    .where(eq(screenshots.id, id))
    .returning();
  await touchProject(shot.projectId);
  return shotDTO(r);
}

export async function deleteScreenshot(userId: string, id: string) {
  const { shot } = await ownedScreenshot(userId, id);
  await db.delete(screenshots).where(eq(screenshots.id, id));
  const vids = await db.select().from(videos).where(eq(videos.projectId, shot.projectId));
  for (const v of vids) {
    if (v.scenes.some((s) => s.screenshotId === id)) {
      await db.update(videos).set({ scenes: v.scenes.filter((s) => s.screenshotId !== id) }).where(eq(videos.id, v.id));
    }
  }
  await touchProject(shot.projectId);
}

export async function duplicateScreenshot(userId: string, id: string): Promise<ScreenshotDTO> {
  const { shot } = await ownedScreenshot(userId, id);
  await db
    .update(screenshots)
    .set({ position: sql`${screenshots.position} + 1` })
    .where(and(eq(screenshots.projectId, shot.projectId), gt(screenshots.position, shot.position)));
  const [r] = await db
    .insert(screenshots)
    .values({ projectId: shot.projectId, position: shot.position + 1, name: `${shot.name} copy`.slice(0, 80), spec: shot.spec })
    .returning();
  await touchProject(shot.projectId);
  return shotDTO(r);
}

export async function reorderScreenshots(userId: string, projectId: string, ids: string[]): Promise<ScreenshotDTO[]> {
  await ownedProject(userId, projectId);
  const rows = await db.select({ id: screenshots.id }).from(screenshots).where(eq(screenshots.projectId, projectId)).orderBy(asc(screenshots.position));
  const valid = new Set(rows.map((r) => r.id));
  const ordered = ids.filter((id) => valid.has(id));
  rows.forEach((r) => {
    if (!ordered.includes(r.id)) ordered.push(r.id);
  });
  await db.transaction(async (tx) => {
    for (let i = 0; i < ordered.length; i++) await tx.update(screenshots).set({ position: i }).where(eq(screenshots.id, ordered[i]));
  });
  await touchProject(projectId);
  return listScreenshots(userId, projectId);
}

export async function applyTemplateToProject(userId: string, projectId: string, templateId: string, screenshotIds?: string[]) {
  await ownedProject(userId, projectId);
  const t = await visibleTemplate(userId, templateId);
  const style = normalizeStyle(t.spec);
  const rows = await db.select().from(screenshots).where(eq(screenshots.projectId, projectId));
  for (const r of rows) {
    if (screenshotIds?.length && !screenshotIds.includes(r.id)) continue;
    await db
      .update(screenshots)
      .set({ spec: normalizeSpec({ ...normalizeSpec(r.spec), ...style }), updatedAt: new Date() })
      .where(eq(screenshots.id, r.id));
  }
  await touchProject(projectId);
  return listScreenshots(userId, projectId);
}

// ---------------- Videos ----------------
export async function ownedVideo(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Video not found");
  const rows = await db
    .select({ video: videos, project: projects })
    .from(videos)
    .innerJoin(projects, eq(projects.id, videos.projectId))
    .where(and(eq(videos.id, id), eq(projects.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new HttpError(404, "Video not found");
  return rows[0];
}

async function projectShotIds(projectId: string) {
  const rows = await db.select({ id: screenshots.id }).from(screenshots).where(eq(screenshots.projectId, projectId)).orderBy(asc(screenshots.position));
  return rows.map((r) => r.id);
}

export async function createVideo(userId: string, projectId: string, input: { name?: string; size?: string; scenes?: unknown; settings?: unknown }): Promise<VideoDTO> {
  const p = await ownedProject(userId, projectId);
  const ids = await projectShotIds(projectId);
  let scenes = normalizeScenes(input.scenes).filter((s) => ids.includes(s.screenshotId));
  if (input.scenes === undefined) {
    const motions: MotionKind[] = ["rise", "scroll", "float", "zoom-in", "pan"];
    const transitions: TransitionKind[] = ["fade", "slide", "slide", "zoom", "push"];
    scenes = ids.slice(0, 6).map((sid, i) => ({ id: randomId(), screenshotId: sid, duration: 4, transition: transitions[i % 5], motion: motions[i % 5] }));
  }
  const settings = normalizeVideoSettings(input.settings ?? { outro: { ...DEFAULT_VIDEO_SETTINGS.outro, badge: p.platforms === "android" ? "google-play" : "app-store" } });
  const size = VIDEO_SIZES.some((v) => v.id === input.size) ? input.size! : p.platforms === "android" ? "android-promo" : "iphone-69";
  const [r] = await db
    .insert(videos)
    .values({ projectId, name: input.name?.trim().slice(0, 80) || "App preview", size, fps: 30, scenes, settings })
    .returning();
  await touchProject(projectId);
  return videoDTO(r);
}

export async function updateVideo(userId: string, id: string, patch: { name?: string; size?: string; scenes?: unknown; settings?: unknown }): Promise<VideoDTO> {
  const { video } = await ownedVideo(userId, id);
  const set: Partial<typeof videos.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.trim().slice(0, 80) || video.name;
  if (patch.size !== undefined && VIDEO_SIZES.some((v) => v.id === patch.size)) set.size = patch.size;
  if (patch.scenes !== undefined) {
    const ids = await projectShotIds(video.projectId);
    set.scenes = normalizeScenes(patch.scenes).filter((s) => ids.includes(s.screenshotId));
  }
  if (patch.settings !== undefined) set.settings = normalizeVideoSettings(patch.settings, normalizeVideoSettings(video.settings));
  const [r] = await db.update(videos).set(set).where(eq(videos.id, id)).returning();
  await touchProject(video.projectId);
  return videoDTO(r);
}

export async function deleteVideo(userId: string, id: string) {
  const { video } = await ownedVideo(userId, id);
  await db.delete(videos).where(eq(videos.id, id));
  await touchProject(video.projectId);
}

export async function duplicateVideo(userId: string, id: string): Promise<VideoDTO> {
  const { video } = await ownedVideo(userId, id);
  const [r] = await db
    .insert(videos)
    .values({ projectId: video.projectId, name: `${video.name} copy`.slice(0, 80), size: video.size, fps: video.fps, scenes: video.scenes, settings: video.settings })
    .returning();
  return videoDTO(r);
}

// ---------------- Templates ----------------
export async function listTemplates(userId: string): Promise<TemplateDTO[]> {
  const rows = await db
    .select()
    .from(templates)
    .where(or(eq(templates.isBuiltin, true), eq(templates.userId, userId)))
    .orderBy(desc(templates.isBuiltin), asc(templates.createdAt));
  return rows.map(templateDTO);
}

export async function visibleTemplate(userId: string, id: string): Promise<TemplateRow> {
  if (!isUuid(id)) throw new HttpError(404, "Template not found");
  const [r] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), or(eq(templates.isBuiltin, true), eq(templates.userId, userId))))
    .limit(1);
  if (!r) throw new HttpError(404, "Template not found");
  return r;
}

async function ownTemplate(userId: string, id: string): Promise<TemplateRow> {
  const t = await visibleTemplate(userId, id);
  if (t.isBuiltin || t.userId !== userId) throw new HttpError(403, "Built-in templates are read-only. Duplicate it to customize.");
  return t;
}

export async function createTemplate(userId: string, input: { name: string; description?: string; category?: string; spec: unknown }): Promise<TemplateDTO> {
  const [r] = await db
    .insert(templates)
    .values({ userId, name: input.name.trim().slice(0, 60), description: input.description?.slice(0, 200) ?? "", category: input.category?.slice(0, 30) || "Custom", spec: normalizeStyle(input.spec) })
    .returning();
  return templateDTO(r);
}

export async function updateTemplate(userId: string, id: string, patch: { name?: string; description?: string; category?: string; spec?: unknown }): Promise<TemplateDTO> {
  const t = await ownTemplate(userId, id);
  const [r] = await db
    .update(templates)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 60) || t.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description.slice(0, 200) } : {}),
      ...(patch.category !== undefined ? { category: patch.category.slice(0, 30) || "Custom" } : {}),
      ...(patch.spec !== undefined ? { spec: normalizeStyle(patch.spec, normalizeStyle(t.spec)) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(templates.id, id))
    .returning();
  return templateDTO(r);
}

export async function deleteTemplate(userId: string, id: string) {
  await ownTemplate(userId, id);
  await db.delete(templates).where(eq(templates.id, id));
}

// ---------------- Assets ----------------
const assetCols = {
  id: assets.id,
  projectId: assets.projectId,
  name: assets.name,
  mimeType: assets.mimeType,
  width: assets.width,
  height: assets.height,
  sizeBytes: assets.sizeBytes,
  createdAt: assets.createdAt,
};
type AssetMetaRow = { id: string; projectId: string | null; name: string; mimeType: string; width: number; height: number; sizeBytes: number; createdAt: Date };
const assetDTO = (r: AssetMetaRow): AssetDTO => ({ ...r, createdAt: r.createdAt.toISOString() });

export function imageInfo(buf: Buffer): { width: number; height: number; mime: string } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), mime: "image/png" };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7), mime: "image/jpeg" };
      }
      off += 2 + len;
    }
    return null;
  }
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), mime: "image/webp" };
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, mime: "image/webp" };
    if (chunk === "VP8L") {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)), mime: "image/webp" };
    }
  }
  return null;
}

export async function listAssets(userId: string, projectId?: string | null): Promise<AssetDTO[]> {
  const where = projectId && isUuid(projectId) ? and(eq(assets.userId, userId), eq(assets.projectId, projectId)) : eq(assets.userId, userId);
  const rows = await db.select(assetCols).from(assets).where(where).orderBy(desc(assets.createdAt));
  return rows.map(assetDTO);
}

export async function createAsset(userId: string, input: { name: string; data: Buffer; projectId?: string | null; createdAt?: Date }): Promise<AssetDTO> {
  if (input.projectId) await ownedProject(userId, input.projectId);
  const info = imageInfo(input.data);
  if (!info) throw new HttpError(415, "Unsupported image. Upload a PNG, JPEG or WebP file.");
  const [r] = await db
    .insert(assets)
    .values({ userId, projectId: input.projectId || null, name: input.name.slice(0, 120) || "upload", mimeType: info.mime, width: info.width, height: info.height, sizeBytes: input.data.length, data: input.data, ...(input.createdAt ? { createdAt: input.createdAt } : {}) })
    .returning(assetCols);
  return assetDTO(r);
}

export async function getAssetFile(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Asset not found");
  const [r] = await db.select({ data: assets.data, mimeType: assets.mimeType, name: assets.name }).from(assets).where(and(eq(assets.id, id), eq(assets.userId, userId))).limit(1);
  if (!r) throw new HttpError(404, "Asset not found");
  return r;
}

export async function loadAssetBuffers(userId: string, ids: string[]): Promise<Record<string, Buffer>> {
  const valid = ids.filter(isUuid);
  if (!valid.length) return {};
  const rows = await db.select({ id: assets.id, data: assets.data }).from(assets).where(and(eq(assets.userId, userId), inArray(assets.id, valid)));
  return Object.fromEntries(rows.map((r) => [r.id, r.data]));
}

export async function updateAsset(userId: string, id: string, patch: { name?: string; projectId?: string | null }): Promise<AssetDTO> {
  if (!isUuid(id)) throw new HttpError(404, "Asset not found");
  if (patch.projectId) await ownedProject(userId, patch.projectId);
  const [r] = await db
    .update(assets)
    .set({ ...(patch.name !== undefined ? { name: patch.name.slice(0, 120) } : {}), ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}) })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
    .returning(assetCols);
  if (!r) throw new HttpError(404, "Asset not found");
  return assetDTO(r);
}

export async function deleteAsset(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Asset not found");
  const r = await db.delete(assets).where(and(eq(assets.id, id), eq(assets.userId, userId))).returning({ id: assets.id });
  if (!r.length) throw new HttpError(404, "Asset not found");
}

// ---------------- Exports ----------------
export async function listExports(userId: string, f: { kind?: string | null; projectId?: string | null; limit?: number } = {}): Promise<ExportDTO[]> {
  const conds = [eq(exportsTable.userId, userId)];
  if (f.kind && ["image", "video", "archive"].includes(f.kind)) conds.push(eq(exportsTable.kind, f.kind));
  if (f.projectId && isUuid(f.projectId)) conds.push(eq(exportsTable.projectId, f.projectId));
  const rows = await db
    .select({
      id: exportsTable.id,
      projectId: exportsTable.projectId,
      projectName: projects.name,
      kind: exportsTable.kind,
      name: exportsTable.name,
      mimeType: exportsTable.mimeType,
      width: exportsTable.width,
      height: exportsTable.height,
      durationSec: exportsTable.durationSec,
      sizeBytes: exportsTable.sizeBytes,
      source: exportsTable.source,
      meta: exportsTable.meta,
      createdAt: exportsTable.createdAt,
    })
    .from(exportsTable)
    .leftJoin(projects, eq(projects.id, exportsTable.projectId))
    .where(and(...conds))
    .orderBy(desc(exportsTable.createdAt))
    .limit(f.limit ?? 200);
  return rows.map((r) => ({ ...r, kind: r.kind as ExportDTO["kind"], projectName: r.projectName ?? null, createdAt: r.createdAt.toISOString() }));
}

export async function createExport(
  userId: string,
  input: { projectId?: string | null; kind: string; name: string; mimeType: string; width?: number | null; height?: number | null; durationSec?: number | null; source: string; meta?: Record<string, unknown>; data: Buffer; createdAt?: Date },
): Promise<ExportDTO> {
  let projectName: string | null = null;
  if (input.projectId) projectName = (await ownedProject(userId, input.projectId)).name;
  const [r] = await db
    .insert(exportsTable)
    .values({
      userId,
      projectId: input.projectId || null,
      kind: input.kind,
      name: input.name.slice(0, 160),
      mimeType: input.mimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      durationSec: input.durationSec ?? null,
      sizeBytes: input.data.length,
      source: input.source,
      meta: input.meta ?? {},
      data: input.data,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
    .returning();
  return {
    id: r.id,
    projectId: r.projectId,
    projectName,
    kind: r.kind as ExportDTO["kind"],
    name: r.name,
    mimeType: r.mimeType,
    width: r.width,
    height: r.height,
    durationSec: r.durationSec,
    sizeBytes: r.sizeBytes,
    source: r.source,
    meta: r.meta,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getExportFile(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Export not found");
  const [r] = await db
    .select({ data: exportsTable.data, mimeType: exportsTable.mimeType, name: exportsTable.name })
    .from(exportsTable)
    .where(and(eq(exportsTable.id, id), eq(exportsTable.userId, userId)))
    .limit(1);
  if (!r) throw new HttpError(404, "Export not found");
  return r;
}

export async function deleteExport(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Export not found");
  const r = await db.delete(exportsTable).where(and(eq(exportsTable.id, id), eq(exportsTable.userId, userId))).returning({ id: exportsTable.id });
  if (!r.length) throw new HttpError(404, "Export not found");
}

// ---------------- API keys ----------------
const keyDTO = (r: typeof apiKeys.$inferSelect): ApiKeyDTO => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  lastUsedAt: iso(r.lastUsedAt),
  revokedAt: iso(r.revokedAt),
  createdAt: r.createdAt.toISOString(),
});

export async function listKeys(userId: string): Promise<ApiKeyDTO[]> {
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
  return rows.map(keyDTO);
}

export async function createKey(userId: string, name: string, extra?: { lastUsedAt?: Date; createdAt?: Date; revokedAt?: Date }) {
  const k = generateApiKey();
  const [r] = await db
    .insert(apiKeys)
    .values({ userId, name: name.trim().slice(0, 60) || "API key", prefix: k.prefix, keyHash: k.hash, ...(extra ?? {}) })
    .returning();
  return { key: keyDTO(r), token: k.token };
}

export async function updateKey(userId: string, id: string, patch: { name?: string; revoked?: boolean }): Promise<ApiKeyDTO> {
  if (!isUuid(id)) throw new HttpError(404, "Key not found");
  const [r] = await db
    .update(apiKeys)
    .set({ ...(patch.name !== undefined ? { name: patch.name.slice(0, 60) } : {}), ...(patch.revoked ? { revokedAt: new Date() } : {}) })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning();
  if (!r) throw new HttpError(404, "Key not found");
  return keyDTO(r);
}

export async function deleteKey(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Key not found");
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}

// ---------------- Stats & profile ----------------
export async function getStats(userId: string) {
  const [[p], [s], [v], [e], [a]] = await Promise.all([
    db.select({ n: count() }).from(projects).where(eq(projects.userId, userId)),
    db.select({ n: count() }).from(screenshots).innerJoin(projects, eq(projects.id, screenshots.projectId)).where(eq(projects.userId, userId)),
    db.select({ n: count() }).from(videos).innerJoin(projects, eq(projects.id, videos.projectId)).where(eq(projects.userId, userId)),
    db.select({ n: count(), bytes: sum(exportsTable.sizeBytes) }).from(exportsTable).where(eq(exportsTable.userId, userId)),
    db.select({ n: count() }).from(assets).where(eq(assets.userId, userId)),
  ]);
  return { projects: Number(p.n), screenshots: Number(s.n), videos: Number(v.n), exports: Number(e.n), exportBytes: Number(e.bytes ?? 0), assets: Number(a.n) };
}

export async function updateProfile(userId: string, patch: { name?: string; email?: string }) {
  if (patch.email) {
    const [other] = await db.select({ id: users.id }).from(users).where(eq(users.email, patch.email.toLowerCase())).limit(1);
    if (other && other.id !== userId) throw new HttpError(409, "That email is already in use");
  }
  const [r] = await db
    .update(users)
    .set({ ...(patch.name ? { name: patch.name.trim().slice(0, 60) } : {}), ...(patch.email ? { email: patch.email.toLowerCase() } : {}) })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt });
  return { ...r, createdAt: r.createdAt.toISOString() };
}

export async function changePassword(userId: string, current: string, next: string) {
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u || !(await verifyPassword(current, u.hash))) throw new HttpError(400, "Current password is incorrect");
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
}
