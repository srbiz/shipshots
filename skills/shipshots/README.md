# shipshots — Agent Skill

Store-ready App Store / Google Play screenshot sets and MP4 preview videos, produced through a running [ShipShots](https://github.com/srbiz/shipshots) server's REST API. This folder is the portable skill package: an agent reads `SKILL.md` and then drives the API to upload simulator captures, style them, and export Fastlane-compatible bundles.

## What it does

- Uploads raw iOS/Android screen captures and turns them into styled store screenshots (12 output sizes, 9 layouts, 10 mock screens).
- Renders exact store dimensions and exports Fastlane `deliver`/`supply` ZIP bundles (`fastlane` or `flat` layout, `png` or `jpeg`).
- Builds and renders MP4 preview videos server-side (H.264 + silent AAC, App Store compliant) via `POST /api/v1/videos/:id/render`.

## Requirements

- A running ShipShots server reachable from the agent (`SHIPSHOTS_URL`, default `http://127.0.0.1:3000`) with PostgreSQL configured (`DATABASE_URL`, `npx drizzle-kit push`).
- An API key (`SHIPSHOTS_KEY`, prefix `ss_live_`) created in the ShipShots **Agent API** page or via the bootstrap steps in `SKILL.md`.
- ffmpeg on the server for video rendering (system ffmpeg, `FFMPEG_PATH`, or the bundled `ffmpeg-static` package). Screenshot/ZIP export works without it.

## Files

| File | Purpose |
| --- | --- |
| `SKILL.md` | The skill definition: triggers, boundaries, agent-runnable setup, 8-step workflow, output format, API reference. |
| `scripts/smoke-test.mjs` | End-to-end verification of a running install (health → catalog → auth → project → PNG → Fastlane ZIP → MP4). |

## Verify an install

```bash
# From this folder, against a running server:
node scripts/smoke-test.mjs

# Reuse an existing key instead of a throwaway account:
SHIPSHOTS_KEY=ss_live_... node scripts/smoke-test.mjs

# Point at a non-default server:
SHIPSHOTS_URL=http://127.0.0.1:3000 node scripts/smoke-test.mjs
```

Prints a PASS/FAIL line per check, keeps generated artifacts on success (path printed at the end), and exits non-zero on any failure.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `SHIPSHOTS_URL` | `http://127.0.0.1:3000` | Base URL of the running ShipShots server. |
| `SHIPSHOTS_KEY` | *(none)* | API key (`ss_live_...`). Without it, the smoke test creates and cleans up a temporary account. |
| `FFMPEG_PATH` | *(none)* | Explicit ffmpeg binary for server-side MP4 rendering (set on the **server**, not this skill). |

## Security notes

- The API key is a secret: never commit it, print it, or embed it in source files.
- The smoke test writes only to the OS temp directory and only contacts `SHIPSHOTS_URL` (localhost by default).
- This skill exports files for the user to review; it never submits to App Store Connect or Play Console.
