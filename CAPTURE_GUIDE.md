# 📸 Capturing Screenshots from Other Projects (e.g. `abhang-katha-sangrah`)

This guide explains how to capture raw screenshots from other mobile or web projects and transform them into App Store and Google Play marketing assets using **ShipShots**.

---

## Step 1: Capture Raw Screenshots from Your App

Select the method matching your project's platform and runtime:

### Option A: Android App (Kotlin/Java, Flutter, React Native, Expo)
If your app is running on an Android Emulator or a connected physical Android device with USB debugging enabled:

```powershell
# Capture the current screen and save directly to an image file
adb exec-out screencap -p > "E:\abhang-katha-sangrah\screen_home.png"
adb exec-out screencap -p > "E:\abhang-katha-sangrah\screen_detail.png"
```

> **Tip for Flutter developers**: You can also use Flutter's built-in screenshot command:
> ```bash
> flutter screenshot -o screen_home.png
> ```

---

### Option B: Web / PWA / Responsive Web App
If the project runs in a web browser (e.g., `localhost:3000` or `localhost:5173`):

#### 1. Using Chrome DevTools (Fastest manual method)
1. Open the running project in Google Chrome.
2. Press <kbd>F12</kbd> (or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>).
3. Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> to toggle the **Device Toolbar** and select a mobile viewport (e.g., *Pixel 7* or *iPhone 14 Pro*).
4. Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>, type **"Capture screenshot"**, and press <kbd>Enter</kbd>.

#### 2. Using Playwright CLI (Automated headless capture)
```powershell
npx playwright screenshot --device="Pixel 7" http://localhost:5173 "E:\abhang-katha-sangrah\screen_home.png"
```

---

### Option C: iOS Simulator (macOS or VM)
```bash
xcrun simctl io booted screenshot screen_home.png
```

---

## Step 2: Import into ShipShots & Generate Store Assets

You can process your screenshots using either the Web Studio or the automated REST API:

### Method 1: Using the ShipShots Web Studio (Visual)

1. **Start the ShipShots server**:
   ```powershell
   cd e:\ShipShots
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser.
3. Click **New Project** and name it (e.g. `Abhang Katha Sangrah`), selecting target platforms (Android, iOS, or both).
4. In the editor or **Assets** tab, click **Upload Screen** and select your captured `.png` files.
5. Customize your store listing cards:
   - **Device Frame**: Select Android Punch-Hole, Pixel, or iPhone frame.
   - **Copywriting**: Add headlines and subheadlines (wrap words in `*asterisks*` for gradient highlights, e.g. `वाचा संपूर्ण *अभंग गाथा*`).
   - **Styling**: Choose background gradients, solid colors, or 3D card tilts.
6. Click **Export** to download individual store-size images or a complete Fastlane-ready ZIP.

---

### Method 2: Fully Automated via the ShipShots REST API

Use this PowerShell script to capture, upload, and generate assets programmatically:

```powershell
$SHIPSHOTS_URL = "http://localhost:3000"
$SHIPSHOTS_KEY = "ss_live_your_key_here"  # Generate in ShipShots -> Agent API
$PROJECT_ID = "your_project_id"

# 1. Capture screen from the running emulator/device
adb exec-out screencap -p > "E:\abhang-katha-sangrah\screen_home.png"

# 2. Upload asset to ShipShots
$uploadRes = curl.exe -s -X POST "$SHIPSHOTS_URL/api/v1/assets" `
  -H "Authorization: Bearer $SHIPSHOTS_KEY" `
  -F "file=@E:\abhang-katha-sangrah\screen_home.png" `
  -F "projectId=$PROJECT_ID" | ConvertFrom-Json

$ASSET_ID = $uploadRes.id

# 3. Create or update screenshot card with marketing copy
curl.exe -s -X POST "$SHIPSHOTS_URL/api/v1/projects/$PROJECT_ID/screenshots" `
  -H "Authorization: Bearer $SHIPSHOTS_KEY" `
  -H "Content-Type: application/json" `
  -d @"
  {
    "headline": "वाचा संपूर्ण *अभंग आणि कथा*",
    "subheadline": "सुलभ आणि सुंदर वाचनाचा अनुभव",
    "assetId": "$ASSET_ID",
    "layout": "headline-top"
  }
"@

# 4. Render and download store-ready package
curl.exe -X POST "$SHIPSHOTS_URL/api/v1/projects/$PROJECT_ID/render" `
  -H "Authorization: Bearer $SHIPSHOTS_KEY" `
  -H "Content-Type: application/json" `
  -d '{"layout":"fastlane","sizes":["android-phone","play-feature"]}' `
  -o "E:\abhang-katha-sangrah\store_assets.zip"
```

---

## Step 3: Publishing to App Stores with Fastlane

Unzip the generated `store_assets.zip` directly into your project root:

```powershell
Expand-Archive -Path "E:\abhang-katha-sangrah\store_assets.zip" -DestinationPath "E:\abhang-katha-sangrah" -Force
```

Then run fastlane commands:
- **Google Play**: `fastlane supply`
- **Apple App Store**: `fastlane deliver`
