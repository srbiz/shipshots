// Server-side App Store / Google Play preview video export.
// Frames are rendered with @napi-rs/canvas using the same engine as the browser editor,
// then encoded to H.264 video + a silent AAC track (App Store Connect expects an audio track)
// with ffmpeg. Binary resolution order: FFMPEG_PATH → system ffmpeg → ffmpeg-static.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import type { Ctx, ImageMap } from "./canvas-utils";
import { renderVideoFrame, videoTimeline, type VideoInput } from "./engine";
import { ensureServerFonts } from "./server";

export class FfmpegUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FfmpegUnavailableError";
  }
}

let ffmpegBin: string | null | undefined;

async function canRun(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const p = spawn(/* turbopackIgnore: true */ bin, ["-version"], { stdio: "ignore", windowsHide: true });
      p.once("error", () => resolve(false));
      p.once("exit", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

/** Resolves a working ffmpeg binary (cached). Returns null when none is usable. */
export async function resolveFfmpeg(): Promise<string | null> {
  if (ffmpegBin !== undefined) return ffmpegBin;
  const candidates: string[] = [];
  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);
  candidates.push("ffmpeg");
  try {
    const mod = (await import("ffmpeg-static")) as { default?: unknown } | unknown;
    const p = typeof mod === "object" && mod && "default" in mod ? (mod as { default?: unknown }).default : mod;
    if (typeof p === "string" && p) candidates.push(p);
  } catch {
    /* ffmpeg-static is an optional fallback */
  }
  for (const c of candidates) {
    if (await canRun(c)) {
      ffmpegBin = c;
      return c;
    }
  }
  ffmpegBin = null;
  return null;
}

export interface VideoRenderOptions {
  width: number;
  height: number;
  /** Device family used to resolve `auto` devices in each scene spec. */
  family: Parameters<typeof renderVideoFrame>[3]["family"];
  fps: number;
  images: ImageMap;
  appName: string;
  brandColor: string;
  /** Hard cap so a single request cannot run unbounded. */
  maxSeconds?: number;
}

export interface VideoRenderResult {
  buffer: Buffer;
  duration: number;
  frames: number;
}

const ENCODE_TIMEOUT_MS = 15 * 60 * 1000;

/** Renders a preview video timeline to an MP4 buffer (H.264 + silent AAC). */
export async function renderVideoMp4(input: VideoInput, opts: VideoRenderOptions): Promise<VideoRenderResult> {
  ensureServerFonts();
  const { total } = videoTimeline(input);
  if (!input.scenes.length || total <= 0) throw new Error("Video timeline is empty");
  const max = opts.maxSeconds ?? 60;
  if (total > max) throw new Error(`Video is ${total.toFixed(1)}s; the server renders at most ${max}s per request`);
  const bin = await resolveFfmpeg();
  if (!bin) {
    throw new FfmpegUnavailableError(
      "No ffmpeg found. Install ffmpeg (https://ffmpeg.org/download.html), run `npm i ffmpeg-static`, or set FFMPEG_PATH to an ffmpeg binary.",
    );
  }

  const width = Math.round(opts.width);
  const height = Math.round(opts.height);
  const fps = Math.min(60, Math.max(10, Math.round(opts.fps) || 30));
  const frames = Math.max(1, Math.round(total * fps));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as Ctx;

  const tmp = path.join(os.tmpdir(), `shipshots-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.mp4`);
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    // video: raw RGBA frames piped from the canvas
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-s",
    `${width}x${height}`,
    "-r",
    String(fps),
    "-i",
    "pipe:0",
    // audio: silent stereo track (App Store Connect requires an audio track)
    "-f",
    "lavfi",
    "-t",
    total.toFixed(3),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-shortest",
    "-movflags",
    "+faststart",
    tmp,
  ];

  try {
    return await new Promise<VideoRenderResult>((resolve, reject) => {
      const child = spawn(/* turbopackIgnore: true */ bin, args, { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] });
      const stderr: Buffer[] = [];
      let settled = false;
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill();
        reject(err);
      };
      const timer = setTimeout(() => fail(new Error("Video encoding timed out")), ENCODE_TIMEOUT_MS);
      child.stderr.on("data", (c: Buffer) => {
        if (stderr.length < 40) stderr.push(c);
      });
      child.on("error", (e) => fail(e));
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          const tail = Buffer.concat(stderr).toString("utf8").slice(-800).trim();
          return fail(new Error(`ffmpeg exited with code ${code}${tail ? `: ${tail}` : ""}`));
        }
        fs.readFile(tmp)
          .then((buffer) => resolve({ buffer, duration: total, frames }))
          .catch((e) => reject(e));
      });

      (async () => {
        for (let i = 0; i < frames; i++) {
          if (settled) return;
          renderVideoFrame(ctx, input, i / fps, {
            width,
            height,
            family: opts.family,
            images: opts.images,
            appName: opts.appName,
            brandColor: opts.brandColor,
          });
          const raw = canvas.data();
          if (!child.stdin.write(raw)) {
            await new Promise<void>((r) => child.stdin.once("drain", () => r()));
          }
        }
        if (!settled) child.stdin.end();
      })().catch((e) => fail(e instanceof Error ? e : new Error(String(e))));
    });
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}
