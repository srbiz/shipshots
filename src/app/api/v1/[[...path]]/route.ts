import { dispatch } from "@/lib/server/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function handle(req: Request, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return dispatch(req, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
