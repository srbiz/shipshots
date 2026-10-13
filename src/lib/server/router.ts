import { asc, eq } from "drizzle-orm";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { screenshots, users } from "@/db/schema";
import { defaultPreviewSize, defaultSizesFor, getOutputSize, OUTPUT_SIZES, VIDEO_SIZES, DEVICES, LAYOUTS, MOCKS, FONTS, TRANSITIONS, MOTIONS } from "@/lib/catalog";
import { exportPath, pad2, slugify } from "@/lib/export-paths";
import { decodeImages, renderScreenshotBuffer } from "@/lib/render/server";
import { collectAssetIds, normalizeSpec, STYLE_KEYS, type Platform } from "@/lib/types";
import { authenticateRequest, createSession, deleteSession, hashPassword, readSessionToken, sessionCookieOptions, SESSION_COOKIE, verifyPassword, type AuthUser } from "./auth";
import * as data from "./data";
import { HttpError } from "./data";
import { DEMO_EMAIL, ensureSeeded } from "./seed";

interface Ctx {
  req: Request;
  url: URL;
  params: Record<string, string>;
  user: AuthUser;
  via: "session" | "key";
}
interface Route {
  method: string;
  path: string;
  auth: "public" | "user" | "session";
  doc?: string;
  handler: (c: Ctx) => Promise<Response>;
}

const json = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { "cache-control": "no-store" } });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

async function readJson(req: Request, allowEmpty = false): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) {
    if (allowEmpty) return {};
    throw new HttpError(400, "Request body is required");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}
async function body<T>(req: Request, schema: z.ZodType<T>, allowEmpty = false): Promise<T> {
  const r = schema.safeParse(await readJson(req, allowEmpty));
  if (!r.success) throw new HttpError(422, r.error.issues.map((i) => `${i.path.map(String).join(".") || "body"}: ${i.message}`).join("; "));
  return r.data;
}

const hex = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/, "must be a hex color like #6366F1")
  .transform((v) => (v.startsWith("#") ? v : `#${v}`).toUpperCase());
const fontEnum = z.enum(["inter", "space-grotesk", "dm-serif", "jetbrains-mono", "poppins"]);
const projectSchema = z.object({
  name: z.string().trim().min(1, "is required").max(60),
  tagline: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  platforms: z.enum(["ios", "android", "both"]).optional(),
  bundleId: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  primaryColor: hex.optional(),
  accentColor: hex.optional(),
  font: fontEnum.optional(),
  templateId: z.string().optional(),
  starter: z.boolean().optional(),
});
const projectPatch = projectSchema.omit({ templateId: true, starter: true }).partial();
const loose = z.record(z.string(), z.unknown());

const SPEC_KEYS: string[] = [...STYLE_KEYS, "headline", "subheadline", "eyebrow", "screen", "screen2", "overrides", "showStatusBar"];
function specFromBody(b: Record<string, unknown>): Record<string, unknown> | undefined {
  const spec: Record<string, unknown> = isObj(b.spec) ? { ...b.spec } : {};
  for (const k of SPEC_KEYS) if (b[k] !== undefined) spec[k] = b[k];
  if (typeof b.assetId === "string") spec.screen = { kind: "asset", assetId: b.assetId };
  if (typeof b.mock === "string") spec.screen = { kind: "mock", mock: b.mock, dark: b.dark !== false };
  return Object.keys(spec).length ? spec : undefined;
}

function sniffImage(buf: Buffer): string | null {
  return data.imageInfo(buf)?.mime ?? null;
}

async function shotIndex(projectId: string, id: string) {
  const rows = await db.select({ id: screenshots.id }).from(screenshots).where(eq(screenshots.projectId, projectId)).orderBy(asc(screenshots.position), asc(screenshots.createdAt));
  return { index: Math.max(0, rows.findIndex((r) => r.id === id)), count: rows.length };
}

function fileResponse(req: Request, buf: Buffer, mime: string, filename: string, inline: boolean, cache = "no-store") {
  const headers: Record<string, string> = {
    "content-type": mime,
    "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^\w.\-]+/g, "_")}"`,
    "cache-control": cache,
    "accept-ranges": "bytes",
  };
  const range = req.headers.get("range");
  const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
  if (m && (m[1] || m[2])) {
    const size = buf.length;
    let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10);
    let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start <= end) {
      return new Response(new Uint8Array(buf.subarray(start, end + 1)), {
        status: 206,
        headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
      });
    }
  }
  return new Response(new Uint8Array(buf), { headers: { ...headers, "content-length": String(buf.length) } });
}

async function login(req: Request, userId: string, payload: unknown) {
  const { token, expires } = await createSession(userId);
  const res = json(payload);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req, expires));
  return res;
}

const routes: Route[] = [
  // ---------- Index & auth ----------
  {
    method: "GET",
    path: "",
    auth: "public",
    handler: async (c) =>
      json({
        name: "ShipShots API",
        version: "1",
        auth: "Authorization: Bearer <API key> (create keys in the Agent API page)",
        docs: `${c.url.origin}/llms.txt`,
        endpoints: routes.filter((r) => r.doc).map((r) => `${r.method} /api/v1/${r.path}`.replace(/\/$/, "") + `  — ${r.doc}`),
      }),
  },
  {
    method: "POST",
    path: "auth/signup",
    auth: "public",
    handler: async (c) => {
      const b = await body(c.req, z.object({ name: z.string().trim().min(1, "is required").max(60), email: z.string().trim().email("must be a valid email"), password: z.string().min(8, "must be at least 8 characters").max(200) }));
      await ensureSeeded();
      const email = b.email.toLowerCase();
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (exists) throw new HttpError(409, "An account with this email already exists");
      const [u] = await db.insert(users).values({ email, name: b.name, passwordHash: await hashPassword(b.password) }).returning();
      return login(c.req, u.id, { ok: true });
    },
  },
  {
    method: "POST",
    path: "auth/login",
    auth: "public",
    handler: async (c) => {
      const b = await body(c.req, z.object({ email: z.string().trim().min(1), password: z.string().min(1) }));
      await ensureSeeded();
      const [u] = await db.select().from(users).where(eq(users.email, b.email.toLowerCase())).limit(1);
      if (!u || !(await verifyPassword(b.password, u.passwordHash))) throw new HttpError(401, "Invalid email or password");
      return login(c.req, u.id, { ok: true });
    },
  },
  {
    method: "POST",
    path: "auth/demo",
    auth: "public",
    handler: async (c) => {
      await ensureSeeded();
      const [u] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
      if (!u) throw new HttpError(500, "Demo account is not available");
      return login(c.req, u.id, { ok: true });
    },
  },
  {
    method: "POST",
    path: "auth/logout",
    auth: "public",
    handler: async (c) => {
      const token = readSessionToken(c.req);
      if (token) await deleteSession(token);
      const res = json({ ok: true });
      res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(c.req, null));
      return res;
    },
  },
  { method: "GET", path: "me", auth: "user", doc: "Current user", handler: async (c) => json({ id: c.user.id, email: c.user.email, name: c.user.name, createdAt: c.user.createdAt.toISOString() }) },
  {
    method: "PATCH",
    path: "me",
    auth: "session",
    handler: async (c) => json(await data.updateProfile(c.user.id, await body(c.req, z.object({ name: z.string().trim().min(1).max(60).optional(), email: z.string().trim().email().optional() })))),
  },
  {
    method: "POST",
    path: "me/password",
    auth: "session",
    handler: async (c) => {
      const b = await body(c.req, z.object({ current: z.string().min(1), next: z.string().min(8, "must be at least 8 characters") }));
      await data.changePassword(c.user.id, b.current, b.next);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "catalog",
    auth: "public",
    doc: "Output sizes, video sizes, devices, layouts, mock screens, fonts",
    handler: async () =>
      json({
        sizes: OUTPUT_SIZES,
        videoSizes: VIDEO_SIZES,
        devices: DEVICES,
        layouts: LAYOUTS,
        mocks: MOCKS,
        fonts: Object.entries(FONTS).map(([id, f]) => ({ id, label: f.label })),
        transitions: TRANSITIONS,
        motions: MOTIONS,
      }),
  },
  { method: "GET", path: "stats", auth: "user", handler: async (c) => json(await data.getStats(c.user.id)) },

  // ---------- Projects ----------
  { method: "GET", path: "projects", auth: "user", doc: "List projects", handler: async (c) => json(await data.listProjects(c.user.id)) },
  { method: "POST", path: "projects", auth: "user", doc: "Create project {name, tagline?, platforms?, primaryColor?, templateId?, starter?}", handler: async (c) => json(await data.createProject(c.user.id, await body(c.req, projectSchema)), 201) },
  { method: "GET", path: "projects/:id", auth: "user", doc: "Project with screenshots and videos", handler: async (c) => json(await data.getProjectDetail(c.user.id, c.params.id)) },
  { method: "PATCH", path: "projects/:id", auth: "user", doc: "Update project", handler: async (c) => json(await data.updateProject(c.user.id, c.params.id, await body(c.req, projectPatch))) },
  {
    method: "DELETE",
    path: "projects/:id",
    auth: "user",
    doc: "Delete project",
    handler: async (c) => {
      await data.deleteProject(c.user.id, c.params.id);
      return json({ ok: true });
    },
  },
  { method: "POST", path: "projects/:id/duplicate", auth: "user", handler: async (c) => json(await data.duplicateProject(c.user.id, c.params.id), 201) },
  { method: "GET", path: "projects/:id/screenshots", auth: "user", doc: "List screenshots", handler: async (c) => json(await data.listScreenshots(c.user.id, c.params.id)) },
  {
    method: "POST",
    path: "projects/:id/screenshots",
    auth: "user",
    doc: "Create screenshot {headline, subheadline, layout?, templateId?, assetId? | mock?}",
    handler: async (c) => {
      const b = await body(c.req, loose, true);
      return json(await data.createScreenshot(c.user.id, c.params.id, { name: typeof b.name === "string" ? b.name : undefined, templateId: typeof b.templateId === "string" ? b.templateId : undefined, spec: specFromBody(b) }), 201);
    },
  },
  {
    method: "PUT",
    path: "projects/:id/screenshots/order",
    auth: "user",
    doc: "Reorder screenshots {ids: string[]}",
    handler: async (c) => json(await data.reorderScreenshots(c.user.id, c.params.id, (await body(c.req, z.object({ ids: z.array(z.string()).max(100) }))).ids)),
  },
  {
    method: "POST",
    path: "projects/:id/apply-template",
    auth: "user",
    doc: "Apply template style {templateId, screenshotIds?}",
    handler: async (c) => {
      const b = await body(c.req, z.object({ templateId: z.string(), screenshotIds: z.array(z.string()).optional() }));
      return json(await data.applyTemplateToProject(c.user.id, c.params.id, b.templateId, b.screenshotIds));
    },
  },
  {
    method: "POST",
    path: "projects/:id/render",
    auth: "user",
    doc: "Render all screenshots → ZIP {sizes?, format?: png|jpeg, layout?: fastlane|flat, save?}",
    handler: async (c) => {
      const b = await body(c.req, z.object({ sizes: z.array(z.string()).optional(), format: z.enum(["png", "jpeg"]).optional(), layout: z.enum(["flat", "fastlane"]).optional(), save: z.boolean().optional(), locale: z.string().max(12).optional() }), true);
      const { project, screenshots: shots } = await data.getProjectDetail(c.user.id, c.params.id);
      if (!shots.length) throw new HttpError(400, "Project has no screenshots");
      const sizes = (b.sizes?.length ? b.sizes : defaultSizesFor(project.platforms)).filter((s) => OUTPUT_SIZES.some((o) => o.id === s));
      if (!sizes.length) throw new HttpError(400, "No valid sizes requested");
      const format = b.format ?? "png";
      const ext = format === "jpeg" ? "jpg" : "png";
      const layout = b.layout ?? "fastlane";
      const images = await decodeImages(await data.loadAssetBuffers(c.user.id, [...new Set(shots.flatMap((s) => collectAssetIds(s.spec)))]));
      const zip = new JSZip();
      const files: string[] = [];
      for (const sizeId of sizes) {
        const size = getOutputSize(sizeId);
        for (let i = 0; i < shots.length; i++) {
          const path = exportPath(layout, size, i, shots[i].spec.headline, ext, b.locale ?? "en-US");
          if (!path) continue;
          const out = await renderScreenshotBuffer(shots[i].spec, sizeId, { images, appName: project.name, brandColor: project.primaryColor, panorama: { index: i, count: shots.length }, format });
          zip.file(path, out.buffer);
          files.push(path);
        }
      }
      zip.file("manifest.json", JSON.stringify({ project: project.name, bundleId: project.bundleId, layout, format, sizes, files, generatedAt: new Date().toISOString() }, null, 2));
      const buf = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
      const name = `${slugify(project.name)}-${layout}-${Date.now().toString(36)}.zip`;
      if (b.save !== false) await data.createExport(c.user.id, { projectId: project.id, kind: "archive", name, mimeType: "application/zip", source: c.via === "key" ? "api" : "editor", meta: { sizes, files: files.length, layout }, data: buf });
      return fileResponse(c.req, buf, "application/zip", name, false);
    },
  },
  { method: "GET", path: "projects/:id/videos", auth: "user", doc: "List preview videos", handler: async (c) => json((await data.getProjectDetail(c.user.id, c.params.id)).videos) },
  {
    method: "POST",
    path: "projects/:id/videos",
    auth: "user",
    doc: "Create preview video {name?, size?, scenes?}",
    handler: async (c) => {
      const b = await body(c.req, loose, true);
      return json(await data.createVideo(c.user.id, c.params.id, { name: typeof b.name === "string" ? b.name : undefined, size: typeof b.size === "string" ? b.size : undefined, scenes: b.scenes, settings: b.settings }), 201);
    },
  },

  // ---------- Screenshots ----------
  { method: "GET", path: "screenshots/:id", auth: "user", doc: "Get screenshot", handler: async (c) => json(data.shotDTO((await data.ownedScreenshot(c.user.id, c.params.id)).shot)) },
  {
    method: "PATCH",
    path: "screenshots/:id",
    auth: "user",
    doc: "Update screenshot {name?, headline?, layout?, spec?, assetId?, ...}",
    handler: async (c) => {
      const b = await body(c.req, loose);
      return json(await data.updateScreenshot(c.user.id, c.params.id, { name: typeof b.name === "string" ? b.name : undefined, spec: specFromBody(b) }));
    },
  },
  {
    method: "DELETE",
    path: "screenshots/:id",
    auth: "user",
    doc: "Delete screenshot",
    handler: async (c) => {
      await data.deleteScreenshot(c.user.id, c.params.id);
      return json({ ok: true });
    },
  },
  { method: "POST", path: "screenshots/:id/duplicate", auth: "user", doc: "Duplicate screenshot", handler: async (c) => json(await data.duplicateScreenshot(c.user.id, c.params.id), 201) },
  {
    method: "GET",
    path: "screenshots/:id/render",
    auth: "user",
    doc: "Render PNG/JPEG ?size=iphone-69&format=png&save=1&download=1",
    handler: async (c) => {
      const { shot, project } = await data.ownedScreenshot(c.user.id, c.params.id);
      const q = c.url.searchParams;
      const sizeId = q.get("size") ?? defaultPreviewSize(project.platforms as Platform);
      if (!OUTPUT_SIZES.some((s) => s.id === sizeId)) throw new HttpError(400, `Unknown size "${sizeId}". Use one of: ${OUTPUT_SIZES.map((s) => s.id).join(", ")}`);
      const format = ["jpg", "jpeg"].includes(q.get("format") ?? "") ? "jpeg" : "png";
      const spec = normalizeSpec(shot.spec);
      const { index, count } = await shotIndex(project.id, shot.id);
      const images = await decodeImages(await data.loadAssetBuffers(c.user.id, collectAssetIds(spec)));
      const out = await renderScreenshotBuffer(spec, sizeId, { images, appName: project.name, brandColor: project.primaryColor, panorama: { index, count }, format });
      const filename = `${slugify(project.name)}-${pad2(index + 1)}-${sizeId}.${format === "jpeg" ? "jpg" : "png"}`;
      if (["1", "true"].includes(q.get("save") ?? "")) {
        await data.createExport(c.user.id, { projectId: project.id, kind: "image", name: filename, mimeType: out.mime, width: out.width, height: out.height, source: c.via === "key" ? "api" : "editor", meta: { size: sizeId, screenshotId: shot.id }, data: out.buffer });
      }
      return fileResponse(c.req, out.buffer, out.mime, filename, !["1", "true"].includes(q.get("download") ?? ""));
    },
  },

  // ---------- Videos ----------
  { method: "GET", path: "videos/:id", auth: "user", doc: "Get preview video", handler: async (c) => json(data.videoDTO((await data.ownedVideo(c.user.id, c.params.id)).video)) },
  {
    method: "PATCH",
    path: "videos/:id",
    auth: "user",
    doc: "Update preview video {name?, size?, scenes?, settings?}",
    handler: async (c) => {
      const b = await body(c.req, loose);
      return json(await data.updateVideo(c.user.id, c.params.id, { name: typeof b.name === "string" ? b.name : undefined, size: typeof b.size === "string" ? b.size : undefined, scenes: b.scenes, settings: b.settings }));
    },
  },
  {
    method: "DELETE",
    path: "videos/:id",
    auth: "user",
    doc: "Delete preview video",
    handler: async (c) => {
      await data.deleteVideo(c.user.id, c.params.id);
      return json({ ok: true });
    },
  },
  { method: "POST", path: "videos/:id/duplicate", auth: "user", handler: async (c) => json(await data.duplicateVideo(c.user.id, c.params.id), 201) },

  // ---------- Templates ----------
  { method: "GET", path: "templates", auth: "user", doc: "List templates (built-in + yours)", handler: async (c) => json(await data.listTemplates(c.user.id)) },
  {
    method: "POST",
    path: "templates",
    auth: "user",
    doc: "Create template {name, description?, category?, spec}",
    handler: async (c) => json(await data.createTemplate(c.user.id, await body(c.req, z.object({ name: z.string().trim().min(1, "is required").max(60), description: z.string().max(200).optional(), category: z.string().max(30).optional(), spec: loose }))), 201),
  },
  {
    method: "PATCH",
    path: "templates/:id",
    auth: "user",
    handler: async (c) => json(await data.updateTemplate(c.user.id, c.params.id, await body(c.req, z.object({ name: z.string().max(60).optional(), description: z.string().max(200).optional(), category: z.string().max(30).optional(), spec: loose.optional() })))),
  },
  {
    method: "DELETE",
    path: "templates/:id",
    auth: "user",
    handler: async (c) => {
      await data.deleteTemplate(c.user.id, c.params.id);
      return json({ ok: true });
    },
  },

  // ---------- Assets ----------
  { method: "GET", path: "assets", auth: "user", doc: "List uploaded screen captures ?projectId=", handler: async (c) => json(await data.listAssets(c.user.id, c.url.searchParams.get("projectId"))) },
  {
    method: "POST",
    path: "assets",
    auth: "user",
    doc: "Upload capture: multipart file=@shot.png | JSON {data: base64, name} | raw image body",
    handler: async (c) => {
      const ct = c.req.headers.get("content-type") ?? "";
      let name = c.url.searchParams.get("name") ?? "capture.png";
      let projectId = c.url.searchParams.get("projectId");
      let buf: Buffer;
      if (ct.includes("multipart/form-data")) {
        const form = await c.req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) throw new HttpError(400, 'Missing "file" field');
        buf = Buffer.from(await file.arrayBuffer());
        name = String(form.get("name") || file.name || name);
        projectId = (form.get("projectId") as string | null) || projectId;
      } else if (ct.includes("application/json")) {
        const b = await body(c.req, z.object({ name: z.string().max(120).optional(), data: z.string().min(16), projectId: z.string().nullable().optional() }));
        const m = /^data:[^;]+;base64,([\s\S]*)$/.exec(b.data);
        buf = Buffer.from(m ? m[1] : b.data, "base64");
        name = b.name ?? name;
        projectId = b.projectId ?? projectId;
      } else {
        buf = Buffer.from(await c.req.arrayBuffer());
      }
      if (!buf.length) throw new HttpError(400, "Empty upload");
      if (buf.length > 25 * 1024 * 1024) throw new HttpError(413, "Images must be under 25 MB");
      if (!sniffImage(buf)) throw new HttpError(415, "Unsupported image. Upload a PNG, JPEG or WebP file.");
      return json(await data.createAsset(c.user.id, { name, data: buf, projectId: projectId || null }), 201);
    },
  },
  {
    method: "PATCH",
    path: "assets/:id",
    auth: "user",
    handler: async (c) => json(await data.updateAsset(c.user.id, c.params.id, await body(c.req, z.object({ name: z.string().trim().min(1).max(120).optional(), projectId: z.string().nullable().optional() })))),
  },
  {
    method: "DELETE",
    path: "assets/:id",
    auth: "user",
    handler: async (c) => {
      await data.deleteAsset(c.user.id, c.params.id);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "assets/:id/file",
    auth: "user",
    handler: async (c) => {
      const f = await data.getAssetFile(c.user.id, c.params.id);
      return fileResponse(c.req, f.data, f.mimeType, f.name, true, "private, max-age=31536000, immutable");
    },
  },

  // ---------- Exports ----------
  { method: "GET", path: "exports", auth: "user", doc: "List exported files ?kind=image|video|archive", handler: async (c) => json(await data.listExports(c.user.id, { kind: c.url.searchParams.get("kind"), projectId: c.url.searchParams.get("projectId") })) },
  {
    method: "POST",
    path: "exports",
    auth: "user",
    doc: "Store a rendered file (raw body) ?name=&kind=&projectId=",
    handler: async (c) => {
      const q = c.url.searchParams;
      const buf = Buffer.from(await c.req.arrayBuffer());
      if (!buf.length) throw new HttpError(400, "Empty upload");
      if (buf.length > 300 * 1024 * 1024) throw new HttpError(413, "Exports must be under 300 MB");
      const mime = (c.req.headers.get("content-type") ?? "application/octet-stream").split(";")[0];
      const kindQ = q.get("kind");
      const kind = kindQ && ["image", "video", "archive"].includes(kindQ) ? kindQ : mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "archive";
      let meta: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(q.get("meta") ?? "{}");
        if (isObj(parsed)) meta = parsed;
      } catch {
        /* ignore */
      }
      const num = (k: string) => (q.get(k) ? Number(q.get(k)) || null : null);
      const exp = await data.createExport(c.user.id, {
        projectId: q.get("projectId") || null,
        kind,
        name: q.get("name") || `export-${Date.now()}`,
        mimeType: mime,
        width: num("width"),
        height: num("height"),
        durationSec: num("duration"),
        source: c.via === "key" ? "api" : "editor",
        meta,
        data: buf,
      });
      return json(exp, 201);
    },
  },
  {
    method: "DELETE",
    path: "exports/:id",
    auth: "user",
    handler: async (c) => {
      await data.deleteExport(c.user.id, c.params.id);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    path: "exports/:id/download",
    auth: "user",
    doc: "Download an exported file (?inline=1 to preview)",
    handler: async (c) => {
      const f = await data.getExportFile(c.user.id, c.params.id);
      return fileResponse(c.req, f.data, f.mimeType, f.name, c.url.searchParams.has("inline"), "private, max-age=600");
    },
  },

  // ---------- API keys (browser session only) ----------
  { method: "GET", path: "keys", auth: "session", handler: async (c) => json(await data.listKeys(c.user.id)) },
  {
    method: "POST",
    path: "keys",
    auth: "session",
    handler: async (c) => json(await data.createKey(c.user.id, (await body(c.req, z.object({ name: z.string().trim().min(1, "is required").max(60) }))).name), 201),
  },
  {
    method: "PATCH",
    path: "keys/:id",
    auth: "session",
    handler: async (c) => json(await data.updateKey(c.user.id, c.params.id, await body(c.req, z.object({ name: z.string().trim().min(1).max(60).optional(), revoked: z.boolean().optional() })))),
  },
  {
    method: "DELETE",
    path: "keys/:id",
    auth: "session",
    handler: async (c) => {
      await data.deleteKey(c.user.id, c.params.id);
      return json({ ok: true });
    },
  },
];

function match(pattern: string, segments: string[]): Record<string, string> | null {
  const parts = pattern ? pattern.split("/") : [];
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(":")) params[parts[i].slice(1)] = decodeURIComponent(segments[i]);
    else if (parts[i] !== segments[i]) return null;
  }
  return params;
}

export async function dispatch(req: Request, segments: string[]): Promise<Response> {
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  let pathMatched = false;
  for (const r of routes) {
    const params = match(r.path, segments);
    if (!params) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    try {
      if (r.auth === "public") {
        return await r.handler({ req, url, params, user: null as unknown as AuthUser, via: "session" });
      }
      const auth = await authenticateRequest(req);
      if (!auth) return json({ error: "Unauthorized. Sign in or pass `Authorization: Bearer <API key>`." }, 401);
      if (r.auth === "session" && auth.via !== "session") return json({ error: "This endpoint requires a browser session" }, 403);
      if (auth.via === "session" && method !== "GET" && req.headers.get("x-requested-with") !== "shipshots") {
        return json({ error: "Missing x-requested-with header" }, 403);
      }
      return await r.handler({ req, url, params, user: auth.user, via: auth.via });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(`[api] ${method} /api/v1/${segments.join("/")}`, e);
      return json({ error: "Internal server error" }, 500);
    }
  }
  return json({ error: pathMatched ? "Method not allowed" : "Not found" }, pathMatched ? 405 : 404);
}
