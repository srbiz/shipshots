// Client-side App Store preview video export.
// Primary path: WebCodecs (H.264) + mp4-muxer → frame-accurate MP4, faster than realtime, with a silent AAC track
// (App Store Connect expects an audio track). Fallback: realtime MediaRecorder capture (MP4 or WebM).
import type { Ctx } from "./canvas-utils";
import { ensureFonts } from "./client";
import { renderVideoFrame, videoTimeline, type RenderOptions, type VideoInput } from "./engine";

export interface VideoExportResult {
  blob: Blob;
  mime: string;
  ext: "mp4" | "webm";
  hasAudio: boolean;
  method: "webcodecs" | "mediarecorder";
}

export interface VideoExportParams {
  input: VideoInput;
  width: number;
  height: number;
  fps: number;
  base: Omit<RenderOptions, "width" | "height" | "anim">;
  onProgress: (p: number) => void;
  signal?: AbortSignal;
}

const abortErr = () => new DOMException("Export cancelled", "AbortError");

export async function exportVideo(p: VideoExportParams): Promise<VideoExportResult> {
  await ensureFonts();
  if (typeof window !== "undefined" && "VideoEncoder" in window) {
    try {
      return await encodeMp4(p);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      console.warn("[video] WebCodecs export failed, falling back to MediaRecorder", e);
    }
  }
  return recordRealtime(p);
}

async function pickCodec(width: number, height: number, fps: number): Promise<VideoEncoderConfig | null> {
  const candidates = ["avc1.640028", "avc1.4d0028", "avc1.640032", "avc1.640033", "avc1.42002a"];
  for (const codec of candidates) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate: 10_000_000, framerate: fps, avc: { format: "avc" } };
    try {
      const s = await VideoEncoder.isConfigSupported(config);
      if (s.supported) return config;
    } catch {
      /* try next */
    }
  }
  return null;
}

const AAC: AudioEncoderConfig = { codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 };

async function aacSupported(): Promise<boolean> {
  if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") return false;
  try {
    const s = await AudioEncoder.isConfigSupported(AAC);
    if (!s.supported) return false;
    let got = 0;
    const enc = new AudioEncoder({ output: () => void got++, error: () => undefined });
    enc.configure(AAC);
    const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: 4800, numberOfChannels: 2, timestamp: 0, data: new Float32Array(9600) });
    enc.encode(ad);
    ad.close();
    await enc.flush();
    enc.close();
    return got > 0;
  } catch {
    return false;
  }
}

async function encodeMp4(p: VideoExportParams): Promise<VideoExportResult> {
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const config = await pickCodec(p.width, p.height, p.fps);
  if (!config) throw new Error("H.264 encoding is not supported in this browser");
  const withAudio = await aacSupported();
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: p.width, height: p.height },
    ...(withAudio ? { audio: { codec: "aac" as const, numberOfChannels: 2, sampleRate: 48000 } } : {}),
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  encoder.configure(config);
  let aenc: AudioEncoder | null = null;
  if (withAudio) {
    aenc = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => {
        failure = e;
      },
    });
    aenc.configure(AAC);
  }

  const canvas = document.createElement("canvas");
  canvas.width = p.width;
  canvas.height = p.height;
  const ctx = canvas.getContext("2d") as Ctx;
  const total = videoTimeline(p.input).total;
  const frames = Math.max(1, Math.round(total * p.fps));
  const totalAudio = Math.ceil(total * 48000);
  let audioWritten = 0;

  for (let i = 0; i < frames; i++) {
    if (p.signal?.aborted) {
      encoder.close();
      aenc?.close();
      throw abortErr();
    }
    if (failure) throw failure;
    const t = i / p.fps;
    if (aenc) {
      // keep ~1s of silent audio ahead of the video so the muxer can interleave
      while (audioWritten < totalAudio && audioWritten / 48000 <= t + 1) {
        const n = Math.min(48000, totalAudio - audioWritten);
        const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((audioWritten / 48000) * 1e6), data: new Float32Array(n * 2) });
        aenc.encode(ad);
        ad.close();
        audioWritten += n;
      }
    }
    renderVideoFrame(ctx, p.input, t, { ...p.base, width: p.width, height: p.height, time: t });
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / p.fps), duration: Math.round(1e6 / p.fps) });
    encoder.encode(frame, { keyFrame: i % (p.fps * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 2));
    if (i % 3 === 0) {
      p.onProgress((i / frames) * 0.97);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await encoder.flush();
  encoder.close();
  if (aenc) {
    await aenc.flush();
    aenc.close();
  }
  if (failure) throw failure;
  muxer.finalize();
  p.onProgress(1);
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), mime: "video/mp4", ext: "mp4", hasAudio: withAudio, method: "webcodecs" };
}

async function recordRealtime(p: VideoExportParams): Promise<VideoExportResult> {
  const mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
  );
  if (!mime) throw new Error("Video export is not supported in this browser. Try Chrome, Edge or Safari.");
  const canvas = document.createElement("canvas");
  canvas.width = p.width;
  canvas.height = p.height;
  canvas.style.cssText = "position:fixed;left:-10000px;top:0;width:8px;height:8px;opacity:0;pointer-events:none";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d") as Ctx;
  const total = videoTimeline(p.input).total;
  const opts = { ...p.base, width: p.width, height: p.height };
  renderVideoFrame(ctx, p.input, 0, opts);
  const stream = canvas.captureStream(p.fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start(250);
  const start = performance.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (p.signal?.aborted) return reject(abortErr());
        const t = (performance.now() - start) / 1000;
        renderVideoFrame(ctx, p.input, Math.min(t, total), { ...opts, time: t });
        p.onProgress(Math.min(0.99, t / total));
        if (t >= total) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    canvas.remove();
  }
  const isMp4 = mime.startsWith("video/mp4");
  p.onProgress(1);
  return {
    blob: new Blob(chunks, { type: isMp4 ? "video/mp4" : "video/webm" }),
    mime: isMp4 ? "video/mp4" : "video/webm",
    ext: isMp4 ? "mp4" : "webm",
    hasAudio: false,
    method: "mediarecorder",
  };
}
