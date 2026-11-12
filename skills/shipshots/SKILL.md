---
name: shipshots
description: Create and export App Store and Google Play screenshot sets from mobile simulator or emulator captures using a running ShipShots server and its REST API.
---

# ShipShots store screenshot workflow

Use this skill when a user wants store-ready App Store or Google Play screenshots for a mobile app. ShipShots styles uploaded captures, renders exact store sizes, and creates Fastlane-compatible ZIP bundles.

## Requirements and boundaries

- The ShipShots server must already be running and reachable from this agent. Use `SHIPSHOTS_URL` (for example, `http://127.0.0.1:3000`) and `SHIPSHOTS_KEY` from the environment. Do not assume the agent can reach the user's `localhost`; in a remote agent environment, ask for a reachable server URL or use an approved tunnel.
- ShipShots requires PostgreSQL. If the service is not running, tell the user to configure `DATABASE_URL`, run `npx drizzle-kit push`, and start it with `npm run dev` or `npm run start` before continuing.
- The API key is a secret. Never print it, put it in a source file, commit it, or ask the user to paste it into a chat. The user creates keys in the ShipShots **Agent API** page.
- Simulator capture is separate from rendering. Capture the actual app UI with the platform's installed tools; do not fabricate a real app capture. If no device or capture is available, use ShipShots' built-in mock screens only when the user agrees to placeholder content.
- This skill automates screenshot PNG/JPEG and Fastlane ZIP exports. MP4 preview encoding is browser-based in ShipShots today; do not claim this API can render videos end-to-end.
- Do not submit assets to App Store Connect or Google Play Console. Export files for the user to review and submit.

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
7. **Verify and report.** Inspect the returned ZIP (including its `manifest.json` and file list), confirm it is non-empty, and tell the user the output path and included sizes. Do not silently overwrite existing files or unzip into the app repository; ask first if the user wants extraction or a different destination.

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

Use `curl --fail-with-body` (or an equivalent HTTP client) so API errors are surfaced instead of being mistaken for generated files. On `401`, ask the user to check the configured key; on `404`, re-fetch the project/screenshot IDs; on `422`, correct the request based on the error and `/catalog`.