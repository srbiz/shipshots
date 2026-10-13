export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal; keepalive?: boolean } = {}): Promise<T> {
  const url = path.startsWith("/") ? path : `/api/v1/${path}`;
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: { "x-requested-with": "shipshots", ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    keepalive: init.keepalive,
    credentials: "same-origin",
  });
  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

export async function uploadFile<T = unknown>(file: File, extra: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const res = await fetch("/api/v1/assets", { method: "POST", body: fd, headers: { "x-requested-with": "shipshots" }, credentials: "same-origin" });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, j.error ?? "Upload failed");
  }
  return (await res.json()) as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
