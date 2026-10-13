import { OUTPUT_SIZES, LAYOUTS, MOCKS, VIDEO_SIZES } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const proto = (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")).split(",")[0];
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const base = `${proto}://${host}`;
  const text = `# ShipShots — store screenshot & preview video generator for coding agents

ShipShots runs as a separate local web server next to your mobile project. It renders
App Store / Google Play screenshots (device frames, captions, backgrounds) and App Store
preview videos. Agents use the REST API below; humans use the web UI at ${base}.

## Auth
Create an API key in the web UI (Agent API page) and send it on every request:
  Authorization: Bearer $SHIPSHOTS_KEY

Base URL: ${base}/api/v1

## Typical agent workflow
1. Capture screens from the simulator/emulator:
     xcrun simctl io booted screenshot home.png
     adb exec-out screencap -p > home.png
2. Upload each capture (returns {id}):
     curl -s -X POST ${base}/api/v1/assets -H "Authorization: Bearer $SHIPSHOTS_KEY" \\
       -F file=@home.png -F projectId=<projectId>
3. Create or update screenshots with marketing copy (wrap words in *asterisks* to highlight):
     curl -s -X POST ${base}/api/v1/projects/<projectId>/screenshots \\
       -H "Authorization: Bearer $SHIPSHOTS_KEY" -H "content-type: application/json" \\
       -d '{"headline":"Ship *faster*","subheadline":"One tap releases","assetId":"<assetId>","layout":"headline-top"}'
4. Render a single PNG:
     curl -o shot.png "${base}/api/v1/screenshots/<id>/render?size=iphone-69&save=1"
5. Render every screenshot for every store size as a fastlane-ready ZIP:
     curl -X POST ${base}/api/v1/projects/<projectId>/render -H "Authorization: Bearer $SHIPSHOTS_KEY" \\
       -H "content-type: application/json" -d '{"layout":"fastlane","sizes":["iphone-69","ipad-13","android-phone"]}' -o store.zip
   Unzip at the repo root and run \`fastlane deliver\` / \`fastlane supply\`.
6. Preview videos (MP4, 886x1920 for App Store) are encoded in the browser: open the
   project in the UI → Preview videos → Render MP4. Configure scenes via PATCH /api/v1/videos/<id>.

## Endpoints
GET    /api/v1/projects                      list projects
POST   /api/v1/projects                      {name, tagline?, platforms?: ios|android|both, primaryColor?, accentColor?, templateId?}
GET    /api/v1/projects/:id                  project + screenshots + videos
PATCH  /api/v1/projects/:id                  update
DELETE /api/v1/projects/:id
POST   /api/v1/projects/:id/screenshots      create (flat fields or {spec})
PUT    /api/v1/projects/:id/screenshots/order {ids:[...]}
POST   /api/v1/projects/:id/apply-template   {templateId}
POST   /api/v1/projects/:id/render           ZIP {sizes?, format?: png|jpeg, layout?: fastlane|flat}
GET    /api/v1/screenshots/:id               get
PATCH  /api/v1/screenshots/:id               {headline?, subheadline?, eyebrow?, layout?, device?, assetId?, mock?, background?, ...}
DELETE /api/v1/screenshots/:id
GET    /api/v1/screenshots/:id/render        ?size=&format=png|jpeg&save=1&download=1
POST   /api/v1/projects/:id/videos           create preview video
PATCH  /api/v1/videos/:id                    {scenes:[{screenshotId,duration,transition,motion}], size?, settings?}
GET    /api/v1/templates                     list templates
POST   /api/v1/assets                        upload capture (multipart / JSON base64 / raw)
GET    /api/v1/exports                       list exported files
GET    /api/v1/exports/:id/download          download
GET    /api/v1/catalog                       all enums below as JSON

## Sizes
${OUTPUT_SIZES.map((s) => `${s.id.padEnd(20)} ${s.width}x${s.height}  ${s.label} — ${s.note}`).join("\n")}

## Video sizes
${VIDEO_SIZES.map((s) => `${s.id.padEnd(20)} ${s.width}x${s.height}  ${s.label}`).join("\n")}

## Layouts
${LAYOUTS.map((l) => `${l.id.padEnd(20)} ${l.description}`).join("\n")}

## Mock screens (used when no capture is uploaded)
${MOCKS.map((m) => m.id).join(", ")}
`;
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
