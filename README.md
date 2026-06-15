# Render Pipeline Dashboard

A local full-stack prototype for a client video render pipeline:

```text
Client Dashboard -> API Server -> PostgreSQL / S3-R2 / Redis Queue
Redis Queue -> GPU Render Worker -> Blender Python / FFmpeg / AI Voice
GPU Render Worker -> Final MP4 in S3-R2 -> Client Review -> TikTok Draft Inbox
```

## Run locally

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## What it includes

- Dashboard UI for render jobs, client review, queue state, and service health.
- Node API server with endpoints for dashboard data, render job creation, and approval.
- Simulated Redis queue and GPU render worker lifecycle.
- AI workflow choices for 3D assets, Blender rendering, character voices, AI video inserts, and FFmpeg assembly.
- Connector cards for Meshy, Tripo, ElevenLabs, Cartesia, Runway, Luma, S3/R2, and TikTok.
- Per-run cost estimate based on selected providers and run size.
- Scene creation page that turns creator inputs into Blender-ready storyboard JSON.
- Live updates with Server-Sent Events.
- TikTok draft creation flow after client approval.

## API

```text
GET  /api/dashboard
GET  /api/events
POST /api/jobs
POST /api/jobs/:id/approve
POST /api/estimate
POST /api/storyboard
POST /api/connectors/:id
DELETE /api/connectors/:id
```

This prototype uses in-memory data so it can run with no external services. The data model and status lifecycle are shaped for later replacement with PostgreSQL, Redis, and S3/R2 integrations.

## Setup Guide

See [SETUP.md](./SETUP.md) for app locations, GitHub push steps, token troubleshooting, and production integration notes.
