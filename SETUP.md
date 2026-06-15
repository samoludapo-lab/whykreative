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
