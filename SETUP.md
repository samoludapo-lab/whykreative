# Setup Guide

## App Location

The app is in this folder:

```text
/Users/sammy/Documents/Codex/2026-06-15/client-dashboard-v-api-server-postgresql
```

Main files:

```text
server.js             Node API server and simulated render pipeline
package.json          App scripts
public/index.html     Dashboard page
public/app.js         Frontend behavior and API calls
public/styles.css     Dashboard styling
README.md             Project overview
```

## Run Locally

From the project folder:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

Run syntax checks:

```bash
npm run check
```

## Production Configuration

Copy the environment template:

```bash
cp .env.example .env
```

Important production variables:

```text
DATABASE_URL
REDIS_URL
SESSION_SECRET
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
MESHY_API_KEY
ELEVENLABS_API_KEY
TIKTOK_CLIENT_ID
TIKTOK_CLIENT_SECRET
```

Run with Docker Compose:

```bash
cd deploy
docker compose up --build
```

Cloud deployment guide:

```text
docs/deployment-guide.md
```

Health checks:

```text
GET /healthz
GET /readyz
```

## What The Prototype Does

This is a local prototype of the pipeline:

```text
Client Dashboard
  -> API Server
  -> PostgreSQL / S3-R2 Storage / Redis Queue
  -> GPU Render Worker
  -> Blender Python / FFmpeg / AI Voice
  -> Final MP4 in S3-R2
  -> User Review
  -> TikTok Upload API
  -> TikTok Draft Inbox
```

The current version runs without external services. PostgreSQL, Redis, S3/R2, GPU rendering, Blender, FFmpeg, AI voice, and TikTok upload are simulated in `server.js` so the full user flow can be tested immediately.

## AI Workflow In The App

The create-job panel now lets you choose:

```text
3D assets: Meshy, Tripo, or uploaded client assets
3D render engine: Blender Python
Character voice: ElevenLabs or Cartesia
Voice role: warm narrator, founder/presenter, customer testimonial, or two-character dialogue
AI video insert: Runway, Luma Dream Machine, or no AI insert
Final assembly: FFmpeg
```

## Scene Creation Page

The Scene page creates the structured storyboard JSON that a Blender worker can consume. The creator can specify:

```text
Core text prompt
Primary subject
Meshy asset prompt
Background/world prompt
Visual style and mood
Scene count, format, resolution, FPS
Blender scene template
Camera move and lens
Lighting setup, atmosphere, material style
Subject motion, background motion, transitions
Render engine, samples, color management
Voice script, voice direction, CTA line
Caption style, music prompt, negative prompt
```

The storyboard JSON includes:

```text
video metadata
creative direction
asset instructions
Blender scene/camera/lighting/render instructions
per-scene timing and animation notes
voice instructions
FFmpeg assembly settings
```

The preview endpoint is:

```text
POST /api/storyboard
```

## Connectors

The dashboard includes connector cards for:

```text
MESHY_API_KEY
TRIPO_API_KEY
ELEVENLABS_API_KEY
CARTESIA_API_KEY
RUNWAY_API_KEY
LUMA_API_KEY
S3_OR_R2_ACCESS_KEY
TIKTOK_CLIENT_ID
```

For the local prototype, connector values are kept only in memory and the UI stores a masked last-four indicator. For production, replace this with encrypted secret storage such as Doppler, AWS Secrets Manager, GCP Secret Manager, Infisical, or your cloud provider's managed secrets service.

You can also set keys as environment variables before starting the app:

```bash
MESHY_API_KEY=... ELEVENLABS_API_KEY=... npm run dev
```

## Run Cost Estimate

The app estimates each run from these editable inputs:

```text
Final seconds
3D asset count
Voice minutes
AI insert seconds
Blender GPU minutes
Selected providers
```

The estimate is intentionally approximate. Actual cost depends on your plan, selected model, retries, output resolution, API access terms, GPU provider, and storage/egress usage.

Current default assumptions in `server.js`:

```text
Meshy: estimated $0.02 per credit, 30 credits per asset
Tripo: estimated $0.60 per asset
Blender GPU: estimated $0.08 per GPU minute
ElevenLabs: estimated $0.18 per voice minute
Cartesia: estimated $0.03 per voice minute
Runway: estimated $0.048 per generated second
Luma: estimated $0.01 per credit, 20 credits per second for 720p-style generation
FFmpeg: estimated $0.02 per run
S3/R2: estimated $0.01 per run
```

Each job moves through this production timeline:

```text
Queued
  -> Script
  -> 3D assets
  -> Blender
  -> Voice
  -> AI video
  -> FFmpeg
  -> Stored
  -> Awaiting review
  -> Approved
  -> TikTok upload
  -> Draft created
```

## GitHub Push

The local repo already has an initial commit and the remote is set to:

```text
https://github.com/samoludapo-lab/whykreative.git
```

Push from your terminal:

```bash
cd /Users/sammy/Documents/Codex/2026-06-15/client-dashboard-v-api-server-postgresql
git push -u origin main
```

If GitHub returns `403`, your token or account does not have write access to the repository. For a fine-grained GitHub token, make sure:

```text
Repository access: samoludapo-lab/whykreative
Repository permissions: Contents -> Read and write
```

Then clear the old cached credential:

```bash
printf "protocol=https\nhost=github.com\nusername=samoludapo-lab\n\n" | git credential reject
```

Add the corrected token:

```bash
read -s GITHUB_TOKEN
printf "protocol=https\nhost=github.com\nusername=samoludapo-lab\npassword=%s\n\n" "$GITHUB_TOKEN" | git credential approve
unset GITHUB_TOKEN
git push -u origin main
```

## Next Production Steps

Replace the simulated services with real integrations:

```text
PostgreSQL: users, projects, jobs, TikTok auth, approval state
Redis: render queue and TikTok upload queue
S3/R2: uploaded assets, generated previews, final MP4 files
GPU worker: separate worker service that runs Blender, FFmpeg, and voice generation
TikTok API: upload approved MP4 as a creator draft
```
