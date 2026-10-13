# 🚀 ShipShots

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Donate](https://img.shields.io/badge/Donate-PayPal-00457C?style=for-the-badge&logo=paypal)](https://paypal.me/GovindBhumkarIN)

> **Automated App Store & Google Play screenshot and preview video generator for mobile developers and AI coding agents.**

ShipShots runs as a dedicated local server alongside your mobile projects (iOS, Android, React Native, Flutter, Expo, Swift, Kotlin). It allows both humans (via an intuitive web studio) and AI coding agents (via a REST API and `/llms.txt`) to create, style, and export store-ready marketing assets and fastlane-compatible bundles in seconds.

📖 **New here?** Follow the [step-by-step tutorial](docs/TUTORIAL.md) — it walks through the studio with screenshots, from first login to store-ready exports.

---

## ✨ Features

- **📱 Multi-Store & Exact Resolution Support**:
  - **Apple App Store**: iPhone 6.9" (16 Pro Max), 6.7", 6.5", 6.3", 5.5" (legacy), iPad 13" (Pro M4), iPad 12.9".
  - **Google Play Store**: Android Phone (1080×1920 & QHD 1440×2560), 7" Tablet, 10" Tablet, and Feature Graphic banner (1024×500).
- **🎨 Device Frames & Finishes**:
  - Realistic device frames with Dynamic Island, Punch-Hole, Slim Bezels, Classic Home Buttons, and Frameless display modes.
  - Authentic hardware finishes: Black Titanium, Natural Titanium, White Titanium, Desert Titanium, Obsidian, Porcelain, Hazel, Space Gray, and more.
- **✨ Built-in Mock Screens**:
  - Instant placeholder screens (Finance, Health, Fitness, Chat, Crypto, E-Commerce, Maps, Podcasts, Recipe, etc.) so you can design templates even before your simulator is open.
- **✍️ Copywriting with Dynamic Accent Highlighting**:
  - Markdown-style word emphasis: wrapping words with `*asterisks*` dynamically styles them with your project's accent or gradient colors.
  - Flexible layouts: `headline-top`, `headline-bottom`, `device-only`, `text-only`, `split`, `card`, `duo-diagonal`, `bleed-bottom`, and `tilt-3d`.
- **🎬 App Store Preview Videos**:
  - Browser-accelerated timeline editor and MP4 video renderer using `mp4-muxer` and WebCodecs/Canvas.
  - Scene transitions, zoom/pan camera motion, and customizable duration.
- **📦 Fastlane & CI/CD Pipeline Ready**:
  - Export a single high-resolution image or download a complete, structured ZIP formatted directly for `fastlane deliver` and `fastlane supply`.
- **🤖 Built for AI Agents**:
  - First-class API key authentication (`Bearer $SHIPSHOTS_KEY`).
  - Self-documenting endpoint at `/llms.txt` so AI agents (Claude Code, Cursor, Antigravity, Windsurf, Copilot) can autonomously discover and call endpoints after UI code updates.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server & Client Components)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript 5.9](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database & ORM**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Graphics & Rendering**:
  - Server-side: [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas)
  - Client-side: HTML5 Canvas API
- **Media & Packaging**:
  - Video muxing: [`mp4-muxer`](https://github.com/Vanilagy/mp4-muxer)
  - ZIP archives: [`jszip`](https://stuk.github.io/jszip/)
- **Icons & UI Helpers**: `lucide-react`, `sonner`, `swr`, `clsx`, `zod`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.x or higher
- **PostgreSQL** database (local or hosted, e.g., Supabase, Neon, Docker)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/srbiz/shipshots.git
   cd shipshots
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to specify your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/shipshots"
   ```

4. **Initialize Database Schema**:
   Push the schema to your database using Drizzle Kit:
   ```bash
   npx drizzle-kit push
   ```

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🤖 AI Agent Workflow

ShipShots is designed to run locally alongside mobile development tasks. When an AI agent modifies screens, it can capture and update the marketing assets automatically.

### 1. Enable Agent Access
1. Sign up / Log in to ShipShots at [http://localhost:3000](http://localhost:3000).
2. Navigate to **Agent API** from the sidebar.
3. Generate a new API Key and copy it (e.g., `ss_live_...`).
4. Set the environment variables in your terminal or agent runner:
   ```bash
   export SHIPSHOTS_URL="http://localhost:3000"
   export SHIPSHOTS_KEY="ss_live_your_key_here"
   ```

### 2. Autonomous Capture & Export Recipe

```bash
# 1. Capture screen from simulator or emulator
xcrun simctl io booted screenshot /tmp/home.png
# Or Android:
# adb exec-out screencap -p > /tmp/home.png

# 2. Upload capture to ShipShots
ASSET_ID=$(curl -s -X POST "$SHIPSHOTS_URL/api/v1/assets" \
  -H "Authorization: Bearer $SHIPSHOTS_KEY" \
  -F "file=@/tmp/home.png" \
  -F "projectId=$PROJECT_ID" | jq -r '.id')

# 3. Create or update screenshot card with marketing copy
curl -s -X POST "$SHIPSHOTS_URL/api/v1/projects/$PROJECT_ID/screenshots" \
  -H "Authorization: Bearer $SHIPSHOTS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"headline\": \"Ship *faster* with confidence\",
    \"subheadline\": \"One tap releases to both app stores\",
    \"assetId\": \"$ASSET_ID\",
    \"layout\": \"headline-top\"
  }"

# 4. Render a single PNG test
curl -o /tmp/shot.png "$SHIPSHOTS_URL/api/v1/screenshots/$SHOT_ID/render?size=iphone-69" \
  -H "Authorization: Bearer $SHIPSHOTS_KEY"

# 5. Export complete Fastlane-ready ZIP bundle
curl -X POST "$SHIPSHOTS_URL/api/v1/projects/$PROJECT_ID/render" \
  -H "Authorization: Bearer $SHIPSHOTS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"layout":"fastlane","sizes":["iphone-69","ipad-13","android-phone","play-feature"]}' \
  -o store.zip

# 6. Unzip directly into your project root
unzip -o store.zip
# Then run: fastlane deliver / fastlane supply
```

### 3. Adding to Agent Instructions (`CLAUDE.md` / `AGENTS.md`)
Add the following snippet to your agent rule file:
```markdown
## App Store & Google Play Screenshots
ShipShots runs locally at http://localhost:3000 (docs: http://localhost:3000/llms.txt).
When modifying UI screens:
1. Capture screenshots using `xcrun simctl io booted screenshot` or `adb exec-out screencap -p`.
2. Upload via `POST /api/v1/assets`.
3. Update project screenshots via `PATCH /api/v1/screenshots/<id>`.
4. Run `POST /api/v1/projects/<id>/render` with `{"layout":"fastlane"}` to refresh store bundles.
```

---

## 📡 REST API Overview

All API endpoints are prefixed with `/api/v1` and require `Authorization: Bearer $SHIPSHOTS_KEY`.

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/v1/catalog` | Get list of supported devices, output sizes, video sizes, and layouts. |
| `GET` | `/api/v1/projects` | List all projects belonging to the user. |
| `POST` | `/api/v1/projects` | Create a new project (`{ name, platforms, primaryColor, accentColor, ... }`). |
| `GET` | `/api/v1/projects/:id` | Fetch project details, screenshots, and videos. |
| `PATCH` | `/api/v1/projects/:id` | Update project metadata. |
| `DELETE` | `/api/v1/projects/:id` | Delete a project. |
| `POST` | `/api/v1/projects/:id/screenshots` | Add a new screenshot to the project. |
| `PUT` | `/api/v1/projects/:id/screenshots/order` | Reorder screenshots (`{ ids: [...] }`). |
| `POST` | `/api/v1/projects/:id/apply-template` | Apply a pre-built styling template across all screenshots. |
| `POST` | `/api/v1/projects/:id/render` | Render and download ZIP bundle (`{ layout: "fastlane" \| "flat", sizes: [...] }`). |
| `GET` | `/api/v1/screenshots/:id` | Get screenshot details. |
| `PATCH` | `/api/v1/screenshots/:id` | Update headline, subheadline, layout, device, background, or asset. |
| `DELETE` | `/api/v1/screenshots/:id` | Delete a screenshot. |
| `GET` | `/api/v1/screenshots/:id/render` | Render single image (`?size=iphone-69&format=png&save=1`). |
| `POST` | `/api/v1/assets` | Upload raw image capture (`multipart/form-data`, JSON base64, or raw binary). |
| `GET` | `/api/v1/templates` | List pre-configured and custom screenshot templates. |
| `GET` | `/api/v1/exports` | View export history and generated assets. |
| `GET` | `/api/v1/exports/:id/download` | Download previously generated export. |

Full machine-readable specification is available at `GET /llms.txt`.

---

## 📂 Project Structure

```text
ShipShots/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Login & Register views
│   │   ├── (app)/                # Studio & Dashboard views
│   │   │   ├── projects/         # Project details & screenshot canvas editor
│   │   │   ├── templates/        # Template browser & customization
│   │   │   ├── assets/           # Media upload and asset library
│   │   │   ├── exports/          # Download history & rendered archives
│   │   │   ├── agent/            # API Key management & agent recipes
│   │   │   └── settings/         # Profile & account settings
│   │   ├── api/                  # REST endpoints (/api/v1/...) & health checks
│   │   └── llms.txt/             # Self-documenting endpoint for AI agents
│   ├── components/               # Reusable React components & UI views
│   │   ├── editor/               # Canvas live rendering, toolbar & layers
│   │   └── views/                # Full page views
│   ├── db/                       # Drizzle ORM schema, migrations, connection pool
│   └── lib/
│       ├── catalog.ts            # Device dimensions, store specs, and layout catalog
│       ├── render/               # Canvas rendering engines (client & server) & video muxer
│       └── server/               # Auth handlers and session management
├── docs/
│   ├── TUTORIAL.md               # Step-by-step studio walkthrough (with screenshots)
│   └── screenshots/              # Tutorial images
├── drizzle.config.json           # Drizzle ORM configuration
├── next.config.ts                # Next.js configuration
├── package.json
└── tsconfig.json
```

---

## 📜 Available Scripts

- `npm run dev`: Launch local Next.js development server with Turbopack.
- `npm run build`: Compile and build optimized production bundle.
- `npm run start`: Start production server.
- `npm run lint`: Run ESLint checks across the codebase.
- `npm run typecheck`: Run TypeScript compiler type checking without emitting files.
- `npx drizzle-kit push`: Sync schema changes directly to PostgreSQL.
- `npx drizzle-kit studio`: Launch Drizzle Studio database visualizer.

---

## ❤️ Support the project

If ShipShots saves you store-submission pain, consider fueling its development:

[![Donate with PayPal](https://img.shields.io/badge/Donate_with-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/GovindBhumkarIN)

- **PayPal:** [paypal.me/GovindBhumkarIN](https://paypal.me/GovindBhumkarIN)
- ⭐ Star the repo and open issues/PRs — both help more than you'd think.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
