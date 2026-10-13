# ShipShots — Step-by-Step Tutorial

A guided tour of the ShipShots studio: from first launch to store-ready exports.
Every screenshot below was captured from the running app.

> **Demo login:** `demo@shipshots.dev` / `demo1234` — the app auto-seeds a demo workspace
> (3 apps · 15 screenshots · 3 preview videos) on first run.

Building a **Capacitor** app? Jump straight to
[§10 Worked example: a Capacitor app](#10-worked-example-a-capacitor-app-prime-calculator)
for a capture → style → fastlane-ZIP walkthrough. Agents (Claude Code, Cursor,
Copilot…) should read
[§11 Coding agent tutorial](#11-coding-agent-tutorial-claude-code-cursor-copilot)
instead — it automates the same loop over the REST API.

---

## 1. Install & configure

```bash
git clone https://github.com/srbiz/shipshots.git
cd shipshots
npm install
cp .env.example .env        # then edit DATABASE_URL
npx drizzle-kit push        # create tables in PostgreSQL
npm run dev                 # http://localhost:3000
```

`.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/shipshots"
```

Requirements: **Node.js 20+** and a running **PostgreSQL** instance.

---

## 2. Sign in

Open [http://localhost:3000](http://localhost:3000) — you land on the sign-in page.
Use the prefilled demo credentials, click **Sign in**, or press
**Explore the demo workspace** for one-click access.

![Sign in](screenshots/01-login.png)

---

## 3. Dashboard

After login you land on the **Dashboard**: workspace stats, your recent projects
(live canvas thumbnails), the Agent API quickstart snippet, and your latest exports.

![Dashboard](screenshots/02-dashboard.png)

---

## 4. Projects

**Projects → New project** creates one entry per app (name, tagline, platforms,
brand colors). Each card previews its screenshot set rendered in the browser.

![Projects](screenshots/03-projects.png)

Open a project to see its **screenshot grid**, device-size switcher
(iPhone 6.9", iPad 13", Android, Feature graphic), and the **Store readiness**
panel that checks App Store / Play Console rules for you.

![Project detail](screenshots/04-project-detail.png)

---

## 5. The screenshot editor

Click any screenshot to open the editor. On the left: **Content** (headline,
subheadline, eyebrow) and **Design** (layout, background, device frame, finish).
On the right: a live canvas preview at the exact store resolution
(1320×2868 for iPhone 6.9").

![Screenshot editor](screenshots/05-screenshot-editor.png)

### Live editing

Type in the copy fields and the canvas re-renders instantly.
Wrap words in `*asterisks*` to highlight them with your accent color —
here `*verification*` renders in cyan. Edits auto-save ("✓ Saved").

![Live editing](screenshots/06-live-editing.png)

The filmstrip at the bottom jumps between screenshots in the set;
**Export** (top right) renders the current shot at full resolution
(server-side, via `@napi-rs/canvas`):

![Rendered export](screenshots/07-rendered-export.png)

---

## 6. Templates

**Templates** holds reusable looks — layout, background, type and device frame.
Built-ins include Aurora, Blueprint, Tilt Shift, Duo Stack, Editorial, Terminal
Green and more. Preview cards are real renders, not mockups.

![Templates](screenshots/08-templates.png)

Apply one to a single screenshot from the editor, or to a whole set with
**Apply template** on the project page.

---

## 7. Exports

**Exports** lists every rendered PNG, ZIP and MP4 — from the editor and from
API calls. Download any artifact directly; ZIP bundles are laid out for
`fastlane deliver` / `fastlane supply`.

![Exports](screenshots/09-exports.png)

From the project page, **Export all** produces a complete fastlane-ready ZIP:

```text
fastlane/
├── screenshots/en-US/01_iphone-69.png ...
└── metadata/android/en-US/images/
    ├── phoneScreenshots/1_android-phone.png ...
    └── featureGraphic.png
```

---

## 8. Preview videos

The **Preview videos** tab opens the timeline editor: scene list with per-scene
duration, transitions (cross-fade, slide, zoom) and camera moves (Ken Burns,
scroll). App Store duration rules are validated live (15–30 s), then
**Render MP4** encodes an H.264 preview via WebCodecs + `mp4-muxer`.

![Video editor](screenshots/10-video-editor.png)

---

## 9. Agent API

**Agent API** manages `ss_live_...` keys so coding agents (Claude Code, Cursor,
CI jobs) can drive ShipShots over REST. Point your agent at
`http://localhost:3000/llms.txt` — a machine-readable spec of every endpoint.

![Agent API](screenshots/11-agent-api.png)

Typical agent loop:

```bash
export SHIPSHOTS_URL="http://localhost:3000"
export SHIPSHOTS_KEY="ss_live_..."

# upload a simulator capture
ASSET_ID=$(curl -s -X POST "$SHIPSHOTS_URL/api/v1/assets" \
  -H "Authorization: Bearer $SHIPSHOTS_KEY" \
  -F "file=@/tmp/home.png" -F "projectId=$PROJECT_ID" | jq -r '.id')

# update copy, then render a fastlane bundle
curl -X POST "$SHIPSHOTS_URL/api/v1/projects/$PROJECT_ID/render" \
  -H "Authorization: Bearer $SHIPSHOTS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"layout":"fastlane"}' -o store.zip
```

See the [README](../README.md#-rest-api-overview) for the full endpoint table.

---

## 10. Worked example: a Capacitor app (Prime Calculator)

This section walks through the full loop with a real **Capacitor** project — a
Vite web app wrapped for Android/iOS with Capacitor. We'll use a fictional app
called **Prime Calculator** (`com.example.primecalculator`); substitute your own
app name and bundle ID throughout.

> The same flow works for any Capacitor/Ionic/Cordova project. Only the capture
> commands depend on the platform.

### 10.1 Project layout you start from

```text
prime-calculator/
├── src/                    # your web app (Vite + Vue/React/Angular)
├── public/
├── android/                # generated native Android project
├── ios/                    # generated native iOS project (optional)
├── capacitor.config.json   # appId, appName, webDir
├── package.json
└── dist/                   # build output (webDir)
```

`capacitor.config.json`:

```json
{
  "appId": "com.example.primecalculator",
  "appName": "Prime Calculator",
  "webDir": "dist"
}
```

### 10.2 Build and launch on an emulator

ShipShots captures the **native shell**, not the browser — so run the app in an
emulator (or on a device) after every UI change:

```bash
# 1. Build the web assets and copy them into the native projects
npm run build
npx cap sync

# 2. Open the native project (first run also installs Gradle/Pods deps)
npx cap open android
# npx cap open ios        # if you generated the ios/ platform
```

Or drive the emulator from the CLI:

```powershell
# Android — list and boot an AVD
emulator -list-avds
emulator -avd Pixel_7_API_34

# install & launch the debug build directly
cd android
.\gradlew installDebug
adb shell am start -n com.example.primecalculator/.MainActivity
```

### 10.3 Capture your key screens

For each screen a store visitor should see (home, core feature, result/detail,
paywall, settings…), bring the emulator to that state and grab a PNG:

```powershell
# Android (PowerShell) — full-screen capture, includes system bars
mkdir captures -Force
adb exec-out screencap -p > captures\01-home.png
adb exec-out screencap -p > captures\02-history.png
adb exec-out screencap -p > captures\03-settings.png

# iOS simulator (if you use the ios/ platform)
xcrun simctl io booted screenshot captures\01-home.png
```

**Capture tips for crisp store shots**

- Use a cold-started app with realistic demo data (not empty states).
- Full-screen captures are fine — framed layouts cover-crop the image into the
  device screen, so the emulator status bar gets cropped away automatically.
- Keep the same device/emulator for the whole set so fonts and spacing match.
- Avoid live clocks/notifications in the status bar if you plan to use
  frameless/full-bleed layouts (the status bar stays visible there).

### 10.4 Create the ShipShots project

In the studio: **New project** → name `Prime Calculator`, platforms `Android`
(and `iOS` if applicable), pick brand colors that match your app. Or via API:

```powershell
$H = @{ Authorization = "Bearer $SHIPSHOTS_KEY" }
$proj = Invoke-RestMethod -Method Post -Uri "$SHIPSHOTS_URL/api/v1/projects" `
  -Headers $H -ContentType "application/json" `
  -Body '{"name":"Prime Calculator","platforms":"android","primaryColor":"#10B981","accentColor":"#34D399"}'
$proj.id
```

### 10.5 Upload captures and write copy

**Studio:** open the project → **Add screenshot** → *Your capture* → drop the
PNG. Then write the headline — wrap words in `*asterisks*` to highlight them
with your accent color:

| # | Headline | Subheadline |
|---|----------|-------------|
| 1 | *Instant* answers as you type | A calculator that keeps up with you |
| 2 | Your history, *searchable* | Every calculation, one swipe away |
| 3 | Make it *yours* | Themes, precision and haptics |

**API:**

```powershell
$asset = Invoke-RestMethod -Method Post -Uri "$SHIPSHOTS_URL/api/v1/assets" `
  -Headers $H -Form @{ file = Get-Item ".\captures\01-home.png"; projectId = $proj.id }

Invoke-RestMethod -Method Post -Uri "$SHIPSHOTS_URL/api/v1/projects/$($proj.id)/screenshots" `
  -Headers $H -ContentType "application/json" `
  -Body ('{"headline":"*Instant* answers as you type","subheadline":"A calculator that keeps up with you","assetId":"' + $asset.id + '","layout":"headline-top"}')
```

### 10.6 Style and export

Pick a template (or hand-tune layout/background/device frame per shot), then
**Export all** — or render a Play-focused bundle from the CLI:

```powershell
Invoke-RestMethod -Method Post -Uri "$SHIPSHOTS_URL/api/v1/projects/$($proj.id)/render" `
  -Headers $H -ContentType "application/json" `
  -Body '{"layout":"fastlane","sizes":["android-phone","android-phone-qhd","play-feature"]}' `
  -OutFile ".\store.zip"
```

### 10.7 Drop the bundle into the Capacitor project

The ZIP is already laid out for `fastlane supply`. Unzip it **at the project
root** — it never touches your web source or native projects:

```powershell
Expand-Archive .\store.zip -DestinationPath . -Force
```

```text
prime-calculator/
├── src/ …
├── android/ …
└── fastlane/
    └── metadata/android/en-US/images/
        ├── phoneScreenshots/1_….png …
        └── featureGraphic.png
```

Then ship it with your existing fastlane setup:

```ruby
# fastlane/Fastfile
lane :play_store_assets do
  supply(skip_upload_screenshots: true, skip_upload_metadata: true)
  # screenshots/feature graphic are picked up from fastlane/metadata/android/
  supply(upload_metadata: true, upload_images: true)
end
```

No fastlane yet? You can also upload the folder manually in the
[Play Console](https://play.google.com/console) → your app → **Main store
listing** → screenshots + feature graphic.

### 10.8 The refresh loop (and agents)

Whenever the UI changes:

1. `npm run build && npx cap sync`
2. Re-launch on the emulator, re-capture the changed screens
3. Re-upload the assets and re-render — in the studio this is two clicks, or
   script it with `POST /api/v1/assets` + `PATCH /api/v1/screenshots/:id` +
   `POST /api/v1/projects/:id/render` (see [§9 Agent API](#9-agent-api)).

A coding agent can own this entire loop autonomously — that's exactly what the
`ss_live_...` keys and `/llms.txt` are for. The next section teaches your agent
to do it.

---

## 11. Coding agent tutorial (Claude Code, Cursor, Copilot…)

ShipShots is designed to be driven end-to-end by an AI coding agent. This
section is the agent-facing companion to §10: same loop, but scripted.

### 11.1 One-time setup

1. Start ShipShots locally (`npm run dev`) and open the **Agent API** page in
   the studio → **Create key** → copy the `ss_live_...` value.
2. Export the connection details wherever your agent runs:

   ```bash
   export SHIPSHOTS_URL="http://localhost:3000"
   export SHIPSHOTS_KEY="ss_live_your_key_here"
   ```

3. Sanity-check:

   ```bash
   curl -s "$SHIPSHOTS_URL/api/v1/me" -H "Authorization: Bearer $SHIPSHOTS_KEY"
   # → {"id":"...","email":"demo@shipshots.dev","name":"Avery Chen",...}
   ```

   `401` means the key is wrong/revoked; connection refused means the server
   isn't running (`curl -s $SHIPSHOTS_URL/api/health` → `{"ok":true}`).

### 11.2 Teach the agent (paste into `AGENTS.md` / `CLAUDE.md`)

```markdown
## App Store & Google Play screenshots (ShipShots)
ShipShots runs locally at http://localhost:3000 — full API spec: /llms.txt
Auth: every request needs `Authorization: Bearer $SHIPSHOTS_KEY`.

When I change UI screens or ask for store assets:
1. Capture: `xcrun simctl io booted screenshot /tmp/s.png` (iOS)
   or `adb exec-out screencap -p > /tmp/s.png` (Android).
2. Look up the project first: GET /api/v1/projects (never create duplicates).
3. Upload: POST /api/v1/assets (-F file=@/tmp/s.png -F projectId=<id>) → {id}.
4. Create: POST /api/v1/projects/<id>/screenshots
   {headline, subheadline, assetId, layout} — wrap words in *asterisks*
   to highlight them in the brand accent color.
   Update existing shots with PATCH /api/v1/screenshots/<id> instead.
5. Verify cheaply first: GET /api/v1/screenshots/<id>/render?size=iphone-69
   (one PNG) before rendering the full bundle.
6. Export: POST /api/v1/projects/<id>/render {"layout":"fastlane","sizes":[...]}
   and unzip the ZIP at the repo root (fastlane/ layout, ready for
   fastlane deliver / supply).
```

### 11.3 Discover before acting

Never guess IDs — the API is fully enumerable:

```bash
H="Authorization: Bearer $SHIPSHOTS_KEY"
curl -s "$SHIPSHOTS_URL/llms.txt"                      # human-readable spec of everything below
curl -s "$SHIPSHOTS_URL/api/v1/catalog" -H "$H"        # sizes, layouts, devices, mocks, fonts as JSON
curl -s "$SHIPSHOTS_URL/api/v1/projects" -H "$H"       # find the project by name → id
curl -s "$SHIPSHOTS_URL/api/v1/projects/$PID" -H "$H"  # project + all screenshots + videos
curl -s "$SHIPSHOTS_URL/api/v1/templates" -H "$H"      # built-in + custom templates
```

Valid size ids for the render calls live in the `catalog` response
(`iphone-69`, `ipad-13`, `android-phone`, `play-feature`, …) — trust it over
hardcoding.

### 11.4 The core loop (copy-paste bash)

```bash
H="Authorization: Bearer $SHIPSHOTS_KEY"

# 1. upload a capture → {"id":"<assetId>", ...}
ASSET_ID=$(curl -s -X POST "$SHIPSHOTS_URL/api/v1/assets" -H "$H" \
  -F file=@/tmp/home.png -F projectId=$PID | jq -r '.id')

# 2. create the screenshot card with marketing copy
SHOT_ID=$(curl -s -X POST "$SHIPSHOTS_URL/api/v1/projects/$PID/screenshots" \
  -H "$H" -H "content-type: application/json" \
  -d "{\"headline\":\"*Instant* answers as you type\",
       \"subheadline\":\"A calculator that keeps up with you\",
       \"assetId\":\"$ASSET_ID\",\"layout\":\"headline-top\"}" | jq -r '.id')

# 3. cheap visual check — one PNG at one size
curl -o /tmp/check.png "$SHIPSHOTS_URL/api/v1/screenshots/$SHOT_ID/render?size=android-phone" -H "$H"

# 4. full fastlane bundle once it looks right
curl -X POST "$SHIPSHOTS_URL/api/v1/projects/$PID/render" -H "$H" \
  -H "content-type: application/json" \
  -d '{"layout":"fastlane","sizes":["android-phone","android-phone-qhd","play-feature"]}' \
  -o store.zip
```

> **No capture yet?** Design the template first with a built-in mock screen:
> create the screenshot with `"mock":"dashboard"` (or `terminal`, `code`,
> `chat`, `analytics`, … — see `GET /api/v1/catalog`) instead of `assetId`,
> then swap in the real capture later via `PATCH {"assetId":"..."}`.

### 11.5 Update in place — never duplicate

The idempotent pattern for "the UI changed, refresh the store shots":

```bash
# find the shot by headline instead of creating a new one
SHOT_ID=$(curl -s "$SHIPSHOTS_URL/api/v1/projects/$PID/screenshots" -H "$H" \
  | jq -r '.[] | select(.headline | contains("Instant")) | .id' | head -1)

# new capture → new asset → point the existing card at it, tweak copy
NEW_ASSET=$(curl -s -X POST "$SHIPSHOTS_URL/api/v1/assets" -H "$H" \
  -F file=@/tmp/home-v2.png -F projectId=$PID | jq -r '.id')
curl -s -X PATCH "$SHIPSHOTS_URL/api/v1/screenshots/$SHOT_ID" -H "$H" \
  -H "content-type: application/json" \
  -d "{\"assetId\":\"$NEW_ASSET\",\"subheadline\":\"Now with offline history\"}"

# re-render the bundle
curl -X POST "$SHIPSHOTS_URL/api/v1/projects/$PID/render" -H "$H" \
  -H "content-type: application/json" -d '{"layout":"fastlane"}' -o store.zip
```

Other useful mutations: `PUT /projects/:id/screenshots/order` (reorder),
`POST /projects/:id/apply-template` (`{templateId}` restyles a whole set),
`DELETE /screenshots/:id` for retired screens.

### 11.6 Outputs in the repo

Unzip `store.zip` at the project root — it only writes under `fastlane/`
(see §10.7). Suggested `.gitignore` entries for the working files:

```gitignore
captures/          # raw emulator screenshots — regenerable, don't commit
store.zip
```

Commit only the `fastlane/` assets you intend to ship with the app.

### 11.7 Agent guardrails

- **Look up before you create** — `GET /projects` by name; duplicate projects
  are the most common agent mistake.
- **Render one PNG before the ZIP** — fast feedback loop, avoids baking bad
  copy into a 13-file bundle.
- **Accent syntax** — `*word*` in headlines/subheadlines becomes the project's
  accent color; that's the only markup the renderer understands.
- **Videos are browser-rendered** — agents can *configure* scenes via
  `POST /projects/:id/videos` and `PATCH /videos/:id`
  (`{scenes:[{screenshotId,duration,transition,motion}]}`), but the MP4 encode
  (WebCodecs) happens when a human clicks **Render MP4** in the UI.
- **Everything is reversible** — screenshots, assets and exports are plain
  rows; `DELETE` endpoints exist for all of them.

---

## Where to go next

- [CAPTURE_GUIDE.md](../CAPTURE_GUIDE.md) — capturing screens from simulators/emulators
- [README.md](../README.md) — features, tech stack, API reference
- `/settings` — profile & account settings in the app

Enjoy shipping! 🚀
