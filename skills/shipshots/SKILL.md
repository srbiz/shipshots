---
name: shipshots
description: Creates and exports store-ready App Store and Google Play screenshot sets and MP4 preview videos from mobile simulator or emulator captures through a running ShipShots server's REST API. Use when the user asks to generate app store screenshots, Play Store listing images, fastlane screenshot bundles, ASO marketing assets, or an app preview video for an iOS or Android app. Triggers: "make store screenshots", "generate app store images", "fastlane screenshots", "export Play Store assets", "preview video for my app".
when_to_use: |
  - User asks to create, refresh, restyle, or export App Store / Google Play screenshots
  - User mentions fastlane deliver or fastlane supply screenshots, ASO assets, or store listing images
  - User wants an MP4 App Store preview video or Google Play promo video built from app screens
  - A UI change in the mobile app should be reflected in store marketing assets
  - Do NOT use for: recording real device video, submitting to App Store Connect or Play Console, or editing photos unrelated to store listings
---

# ShipShots store screenshot workflow

Use this skill when a user wants store-ready App Store or Google Play screenshots (and optionally a preview video) for a mobile app. ShipShots styles uploaded captures, renders exact store sizes, and creates Fastlane-compatible ZIP bundles.

## Requirements and boundaries

- The ShipShots server must already be running and reachable from this agent. Use `SHIPSHOTS_URL` (for example, `http://127.0.0.1:3000`) and `SHIPSHOTS_KEY` from the environment. Do not assume the agent can reach the user's `localhost`; in a remote agent environment, ask for a reachable server URL or use an approved tunnel.
- ShipShots requires PostgreSQL. If the service is not running, tell the user to configure `DATABASE_URL`, run `npx drizzle-kit push`, and start it with `npm run dev` or `npm run start` before continuing — or offer the bootstrap steps below.
- MP4 preview video rendering requires ffmpeg on the server (system ffmpeg, `FFMPEG_PATH`, or the bundled `ffmpeg-static` package). If `POST /videos/:id/render` returns `503`, report the install hint from the error instead of retrying.
- The API key is a secret. Never print it, put it in a source file, commit it, or ask the user to paste it into a chat. The user creates keys in the ShipShots **Agent API** page, or the agent can create one during bootstrap (below) without exposing it.
- Simulator capture is separate from rendering. Capture the actual app UI with the platform's installed tools; do not fabricate a real app capture. If no device or capture is available, use ShipShots' built-in mock screens only when the user agrees to placeholder content.
- Do not submit assets to App Store Connect or Google Play Console. Export files for the user to review and submit.

## First-time setup (agent-runnable)

Only when the user agrees to installing ShipShots locally:

1. `git clone https://github.com/srbiz/shipshots && cd shipshots && npm install`
2. `cp .env.example .env` and point `DATABASE_URL` at a PostgreSQL database (create one if needed, e.g. `createdb shipshots`).
3. `npx drizzle-kit push && npm run build && npm start` (or `npm run dev`).
4. Create credentials without a browser — sign up, then create an API key using the session cookie:

   ```bash
   curl -c cookies.txt -X POST "$SHIPSHOTS_URL/api/v1/auth/signup" \
     -H "content-type: application/json" \
     -d '{"name":"Agent","email":"you@example.com","password":"<a generated password>"}'
   curl -b cookies.txt -X POST "$SHIPSHOTS_URL/api/v1/keys" \
     -H "content-type: application/json" -H "x-requested-with: shipshots" \
     -d '{"name":"agent"}'
   ```

   The second response's `token` (prefix `ss_live_`) is the API key. Store it as `SHIPSHOTS_KEY`, delete `cookies.txt`, and never echo the token. (The `x-requested-with: shipshots` header is required for session-authenticated writes.)
5. Verify the install: run `node scripts/smoke-test.mjs` from this skill's folder. It checks health, catalog, auth, project creation, PNG render, Fastlane ZIP, and MP4 render, prints a PASS/FAIL summary, and exits non-zero on failure. Without `SHIPSHOTS_KEY` it uses (and cleans up) a throwaway account.

## Workflow

1. **Check service and formats.** Call `GET $SHIPSHOTS_URL/api/v1/catalog` (public) to confirm service availability and discover supported `sizes`, `layouts`, and mock screens. For private endpoints use `Authorization: Bearer $SHIPSHOTS_KEY`.
2. **Choose a project.** Call `GET /api/v1/projects`. Reuse a matching project, or ask before creating one with `POST /api/v1/projects` and a JSON body such as `{"name":"My App","platforms":"both","bundleId":"com.example.myapp"}`. Creating a project adds starter mock screenshots unless `"starter":false` is specified.
3. **Capture the screens.** Use the project's existing simulator/emulator workflow (for example, `xcrun simctl io booted screenshot /tmp/home.png` on iOS or `adb exec-out screencap -p > /tmp/home.png` on Android). Capture each relevant app state and use descriptive filenames. Never upload unrelated or sensitive screen content without the user's approval.
4. **Upload each image.** Use multipart form data and include the project ID:

   ```bash
   curl --fail-with-body -sS -X POST "$SHIPSHOTS_URL/api/v1/assets" \
     -H "Authorization: Bearer $SHIPSHOTS_KEY" \
     -F "file=@/tmp/home.png" \
     -F "projectId=$PROJECT_ID"
   ```

   Read the returned asset `id`; do not assume a project, screenshot, or asset ID.
5. **Create one screenshot per capture.** Call `POST /api/v1/projects/$PROJECT_ID/screenshots` with fields such as `name`, `headline`, `subheadline`, `assetId`, and `layout`. Example:

   ```json
   {"name":"Home","headline":"Plan your day with *clarity*","subheadline":"Everything in one place","assetId":"ASSET_ID","layout":"headline-top"}
   ```

   The API creates a new screenshot each time. For existing screenshots, use `PATCH /api/v1/screenshots/$SHOT_ID` instead. Use a supported layout from `/catalog`; keep marketing copy truthful and ask the user to approve copy when the product claims are unclear.
6. **Render the bundle.** Ask which platforms/locales the user needs if unclear. Choose valid output size IDs from `/catalog`, then call `POST /api/v1/projects/$PROJECT_ID/render` with `{"layout":"fastlane","sizes":["iphone-69","android-phone"],"locale":"en-US"}`. The response body is a ZIP file; save it to a user-visible output path. `layout` can be `fastlane` or `flat`, and `format` can be `png` or `jpeg`.
7. **Render a preview video (optional).** If the user wants an MP4 preview/promo video, create a timeline — `POST /api/v1/projects/$PROJECT_ID/videos` with `{}` auto-builds scenes from the project's screenshots (or pass `{"scenes":[{"screenshotId":"...","duration":4,"transition":"fade","motion":"rise"}]}`). Then render it:

   ```bash
   curl --fail-with-body -sS -X POST "$SHIPSHOTS_URL/api/v1/videos/$VIDEO_ID/render" \
     -H "Authorization: Bearer $SHIPSHOTS_KEY" -H "content-type: application/json" \
     -d '{"save":true}' -o preview.mp4
   ```

   The MP4 is H.264 with a silent AAC track (App Store requirement). Rendering is capped at 60 seconds per request; App Store previews must be 15–30 seconds, so confirm the total duration fits the target store. Use `{"save":false}` to skip the export history entry.
8. **Verify and report.** Inspect the returned ZIP (including its `manifest.json` and file list) and any MP4 (non-empty, starts with an `ftyp` box), confirm they are files rather than error JSON, and tell the user the output path and included sizes. Do not silently overwrite existing files or unzip into the app repository; ask first if the user wants extraction or a different destination.

## Output format

Report results to the user in this exact structure (Markdown):

```markdown
## ShipShots export

- **Server:** $SHIPSHOTS_URL (healthy)
- **Project:** <name> (<projectId>)
- **Bundle:** <output path>.zip — <layout> layout, locale <locale>, sizes: <size ids>
  - Structure verified: fastlane metadata/ dirs + manifest.json (or flat/)
- **Video (if rendered):** <output path>.mp4 — <width>x<height>, <duration>s, H.264 + AAC
- **Next step:** review the files, then submit to App Store Connect / Play Console yourself (not done by this skill).
```

Rules:

- Always give concrete local file paths and the size IDs actually included — never say "done" without them.
- On failure, report the HTTP status and the API's `error` message verbatim instead of this success block.
- If any verification step failed (bad ZIP magic, missing `ftyp`, error JSON), do not present the export as successful.

## API reference

- Base URL: `$SHIPSHOTS_URL/api/v1`
- Authentication: `Authorization: Bearer $SHIPSHOTS_KEY`
- Machine-readable live endpoint documentation: `$SHIPSHOTS_URL/llms.txt`
- Supported output size IDs and visual layouts: `GET /catalog`
- Project and screenshot details: `GET /projects`, `GET /projects/{id}`
- Upload capture: `POST /assets`
- Add/update screenshot: `POST /projects/{id}/screenshots`, `PATCH /screenshots/{id}`
- Render bundle: `POST /projects/{id}/render`
- Render one image: `GET /screenshots/{id}/render?size=iphone-69&format=png`
- Preview video: `POST /projects/{id}/videos`, `PATCH /videos/{id}`, render `POST /videos/{id}/render` → MP4

Use `curl --fail-with-body` (or an equivalent HTTP client) so API errors are surfaced instead of being mistaken for generated files. On `401`, ask the user to check the configured key; on `404`, re-fetch the project/screenshot/video IDs; on `422`, correct the request based on the error and `/catalog`; on `503` from video render, the server has no ffmpeg — relay the install hint.
